/**
 * Running Analysis Orchestrator
 *
 * Pipeline:
 * 1. Sync fresh Garmin activities into Supabase
 * 2. Determine week range (Mon–Sun, current week to date by default)
 * 3. Enrich per-lap detail for runs that still lack it (rate-limited, best effort)
 * 4. Read the week's runs out of Supabase
 * 5. Generate weekly analysis via Claude API
 * 6. Upsert to Supabase `running_weekly_insights`
 *
 * Fully Notion-free: this runs with NOTION_API_KEY unset.
 */

import { syncRecentActivities, syncActivityDetailsFor, isGarminBlocked } from '@/lib/sync/garmin';
import { getRunsForPeriod } from './runs-repo';
import { generateWeeklyAnalysis, HistoricalContext, PlanContext } from './analysis-engine';
import { upsertWeeklyInsight, getPreviousWeekInsight } from './weekly-insights-store';
import { loadWeekSchedule, loadCardioProtocol } from './plan-loader';

// Date the runner began strict adherence to the structured cardio plan.
// Pre-adherence data is a weak baseline for pace/HR comparisons.
const PLAN_ADHERENCE_START = '2026-04-13';

// Earliest date the historical baseline reaches back to.
const HISTORY_START = '2026-01-01';

// WIB timezone offset
const WIB_OFFSET = 7 * 60 * 60 * 1000;

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function getWibNow(): Date {
  return new Date(Date.now() + WIB_OFFSET);
}

/** Get the Mon–Sun week range for a given WIB date string (YYYY-MM-DD) */
function getWeekRange(dateStr: string): { weekStart: string; weekEnd: string } {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - daysFromMon);

  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);

  return {
    weekStart: mon.toISOString().split('T')[0],
    weekEnd: sun.toISOString().split('T')[0],
  };
}

/** Get the current Mon–today range in WIB (used for Saturday trigger) */
function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const wibNow = getWibNow();
  const wibToday = wibNow.toISOString().split('T')[0];
  const { weekStart } = getWeekRange(wibToday);
  return { weekStart, weekEnd: wibToday };
}

export interface RunningAnalysisOptions {
  date?: string;           // Override week date (YYYY-MM-DD) — defaults to current week to date
  analysisOnly?: boolean;  // Skip the detail-enrichment pass, only run analysis
  forceResync?: boolean;   // Re-enrich per-lap detail even for runs that already have it
}

export interface RunningAnalysisResult {
  weekStart: string;
  weekEnd: string;
  /** How many activities Garmin returned via getActivities(0, 20). null = sync was skipped or failed before fetching. */
  garminFetched: number | null;
  /** How many activities were upserted into Supabase. null = sync was skipped or failed. */
  garminSynced: number | null;
  /** Reason the Garmin sync was skipped (circuit-breaker) or the error message if it threw. null on success. */
  garminSkipReason: string | null;
  activitiesFound: number;
  /** Runs that gained a per-lap detail row this pass. */
  activitiesIngested: number;
  /** Runs skipped because they already had per-lap detail. */
  activitiesSkipped: number;
  analysisGenerated: boolean;
  weeklyInsightUpdated: boolean;
  errors: string[];
  timestamp: string;
}

export async function runRunningAnalysis(options: RunningAnalysisOptions = {}): Promise<RunningAnalysisResult> {
  // Determine week range
  let weekRange: { weekStart: string; weekEnd: string };
  if (options.date) {
    weekRange = getWeekRange(options.date);
  } else {
    weekRange = getCurrentWeekRange();
  }

  const { weekStart, weekEnd } = weekRange;
  const errors: string[] = [];
  let activitiesIngested = 0;
  let activitiesSkipped = 0;
  let analysisGenerated = false;
  let weeklyInsightUpdated = false;
  let garminFetched: number | null = null;
  let garminSynced: number | null = null;
  let garminSkipReason: string | null = null;

  // --- Step 0: Sync fresh Garmin data so today's activities are available ---
  try {
    const blockStatus = await isGarminBlocked();
    if (blockStatus.blocked) {
      garminSkipReason = `circuit-breaker: ${blockStatus.reason}`;
      console.log(`[running-analysis] Garmin sync skipped: ${blockStatus.reason}`);
      errors.push(`Garmin sync skipped: ${blockStatus.reason}`);
    } else {
      console.log('[running-analysis] Syncing recent Garmin activities…');
      const syncResult = await syncRecentActivities();
      garminFetched = syncResult.fetched;
      garminSynced = syncResult.synced;
      console.log(`[running-analysis] Garmin activity sync done: fetched ${syncResult.fetched}, upserted ${syncResult.synced}`);
      if (syncResult.fetched === 0) {
        errors.push('Garmin returned 0 activities — token may need refresh');
      } else if (syncResult.synced < syncResult.fetched) {
        errors.push(`Garmin sync partial: ${syncResult.synced}/${syncResult.fetched} upserted`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    garminSkipReason = `error: ${msg}`;
    console.warn('[running-analysis] Garmin sync failed (continuing with existing data):', msg);
    errors.push(`Garmin sync failed: ${msg}`);
  }

  // --- Step 1: Read this week's runs out of Supabase ---
  const weekRuns = await getRunsForPeriod(weekStart, weekEnd);
  const activitiesFound = weekRuns.length;

  // --- Step 2: Enrich per-lap detail for runs that still lack it ---
  // The prompt leans hard on lap-level data and the session profile, and neither exists until a
  // run has been through the (rate-limited, 3-calls-each) detail enrichment. syncRecentActivities
  // above only writes garmin_activities, so this is the step that fills the gap.
  //
  // The candidate window reaches 14 days back rather than just the analysed week: if Garmin was
  // rate-limited on the day a run happened, the run would otherwise never get a second chance.
  // Costs nothing when there is nothing to do, since rows that already have laps are filtered out.
  if (!options.analysisOnly && activitiesFound > 0) {
    try {
      const lookbackStart = addDaysIso(weekStart, -14);
      const candidates = await getRunsForPeriod(lookbackStart, weekEnd);
      const ids = candidates.filter((r) => options.forceResync || r.laps.length === 0).map((r) => r.activityId);

      if (ids.length > 0) {
        const detailRes = await syncActivityDetailsFor(ids, { force: options.forceResync });
        activitiesIngested = detailRes.written;
        activitiesSkipped = detailRes.skipped;
        errors.push(...detailRes.errors);
        console.log(
          `[running-analysis] activity-details: written ${detailRes.written}, skipped ${detailRes.skipped}` +
            (detailRes.blocked ? ' (halted early)' : ''),
        );
      }
    } catch (err) {
      // createGarminClient throws when the circuit breaker is open or the budget is spent.
      // A blocked Garmin degrades the analysis; it must not fail it.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[running-analysis] activity-details enrichment unavailable:', msg);
      errors.push(`Activity details: ${msg}`);
    }
  }

  // --- Step 3: Generate weekly analysis ---
  try {
    // Re-read the week now that Step 2 may have added laps.
    const thisWeekRuns = await getRunsForPeriod(weekStart, weekEnd);

    // Build historical context from ALL runs before this week
    let historicalContext: HistoricalContext | null = null;
    try {
      const allPrevious = await getRunsForPeriod(HISTORY_START, weekStart);
      const prevRuns = allPrevious.filter((r) => r.date < weekStart);

      if (prevRuns.length > 0) {
        const avgPaces = prevRuns.map((r) => {
          const [m, s] = r.avgPacePerKm.split(':').map(Number);
          return m * 60 + (s || 0);
        }).filter((p) => p > 0);
        const avgPaceSec = avgPaces.length > 0 ? avgPaces.reduce((a, b) => a + b, 0) / avgPaces.length : 0;
        const pm = Math.floor(avgPaceSec / 60);
        const ps = Math.round(avgPaceSec % 60);

        const avgHrs = prevRuns.map((r) => r.avgHr).filter((h): h is number => h != null);
        const avgHrVal = avgHrs.length > 0 ? Math.round(avgHrs.reduce((a, b) => a + b, 0) / avgHrs.length) : null;

        const avgDist = Math.round(prevRuns.reduce((s, r) => s + r.distanceKm, 0) / prevRuns.length * 10) / 10;

        historicalContext = {
          avgPacePerKm: `${pm}:${ps.toString().padStart(2, '0')}`,
          avgHr: avgHrVal,
          avgDistanceKm: avgDist,
          totalRuns: prevRuns.length,
          periodLabel: 'All previous runs',
        };
      }
    } catch (err) {
      console.warn('[running-analysis] Could not build historical context:', err);
    }

    // Fetch plan-awareness inputs in parallel. Each failure is non-fatal —
    // fall back to null so the synthesis still runs if a dependency is down.
    const [previousWeekInsight, weekSchedule, cardioProtocolMd] = await Promise.all([
      getPreviousWeekInsight(weekStart).catch((err) => {
        console.warn('[running-analysis] getPreviousWeekInsight failed:', err);
        return null;
      }),
      loadWeekSchedule(weekStart, weekEnd).catch((err) => {
        console.warn('[running-analysis] loadWeekSchedule failed:', err);
        return { lastWeek: [], thisWeek: [], nextWeek: [] };
      }),
      loadCardioProtocol().catch((err) => {
        console.warn('[running-analysis] loadCardioProtocol failed:', err);
        return '';
      }),
    ]);

    const planContext: PlanContext | null =
      weekSchedule.thisWeek.length > 0 || cardioProtocolMd.length > 0
        ? {
            lastWeek: weekSchedule.lastWeek,
            thisWeek: weekSchedule.thisWeek,
            nextWeek: weekSchedule.nextWeek,
            cardioProtocolMd,
            planAdherenceStartDate: PLAN_ADHERENCE_START,
          }
        : null;

    const today = getWibNow().toISOString().split('T')[0];
    const analysis = await generateWeeklyAnalysis(
      weekStart,
      weekEnd,
      thisWeekRuns,
      historicalContext,
      previousWeekInsight,
      planContext,
      today,
    );
    analysisGenerated = true;

    // --- Step 4: Upsert to running_weekly_insights ---
    try {
      await upsertWeeklyInsight(analysis);
      weeklyInsightUpdated = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Weekly insights: ${msg}`);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Analysis: ${msg}`);
    console.error('[running-analysis] Analysis failed:', msg);
  }

  return {
    weekStart,
    weekEnd,
    garminFetched,
    garminSynced,
    garminSkipReason,
    activitiesFound,
    activitiesIngested,
    activitiesSkipped,
    analysisGenerated,
    weeklyInsightUpdated,
    errors,
    timestamp: new Date().toISOString(),
  };
}

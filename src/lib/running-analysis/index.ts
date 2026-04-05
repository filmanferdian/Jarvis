/**
 * Running Analysis Orchestrator
 *
 * Pipeline:
 * 1. Determine week range (Mon–Sun, previous week by default)
 * 2. Query Supabase for outdoor running activities in that week
 * 3. Redundancy check: skip activities already in Notion Runs DB
 * 4. For new activities: enrich from Garmin API → write to Notion Runs DB
 * 5. Generate weekly analysis via Claude API
 * 6. Upsert to Weekly Insights Notion DB
 * 7. Update Running Log dashboard
 */

import { supabase } from '@/lib/supabase';
import { enrichActivity, EnrichedActivityData } from './garmin-enrich';
import { getExistingGarminIds, createRunPage, patchRunPage, findRunPageByGarminId, getRunsForPeriod, RunActivity } from './notion-runs-db';
import { extractRunSummaries, generateWeeklyAnalysis, HistoricalContext } from './analysis-engine';
import { upsertWeeklyInsight } from './weekly-insights-db';
import { updateRunningLogDashboard } from './dashboard-update';

// Outdoor running activity types to include (excludes treadmill, indoor, walking)
const OUTDOOR_RUNNING_TYPES = new Set([
  'running',
  'track_running',
  'trail_running',
  'road_running',
  'ultra_run',
  'obstacle_run',
  'virtual_run',
]);

function isOutdoorRun(activityType: string | null): boolean {
  if (!activityType) return false;
  const t = activityType.toLowerCase();
  // Explicit outdoor types
  if (OUTDOOR_RUNNING_TYPES.has(t)) return true;
  // Exclude treadmill and indoor variants explicitly
  if (t.includes('treadmill') || t.includes('indoor')) return false;
  // Include other running variants (e.g. "running" prefix)
  return t === 'running' || (t.includes('run') && !t.includes('treadmill') && !t.includes('indoor'));
}

// WIB timezone offset
const WIB_OFFSET = 7 * 60 * 60 * 1000;

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

interface GarminActivityRow {
  activity_id: string;
  activity_type: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  avg_pace: string | null;
  avg_hr: number | null;
  calories: number | null;
  started_at: string | null;
  raw_json: Record<string, unknown> | null;
}

/** Extract city name from activity name like "Bandung Running" → "Bandung" */
function extractLocationFromName(name: string): string | null {
  if (!name) return null;
  const match = name.match(/^(.+?)\s+Running$/i);
  return match ? match[1] : null;
}

function extractRunActivity(row: GarminActivityRow, enriched: EnrichedActivityData): RunActivity {
  const raw = row.raw_json ?? {};

  // Parse date in WIB
  const startedAt = row.started_at ? new Date(row.started_at) : null;
  const wibDate = startedAt
    ? new Date(startedAt.getTime() + WIB_OFFSET).toISOString().split('T')[0]
    : '';

  const distanceKm = row.distance_meters != null
    ? Math.round((row.distance_meters / 1000) * 100) / 100
    : 0;

  // Duration formatted
  const durS = row.duration_seconds ?? 0;
  const h = Math.floor(durS / 3600);
  const m = Math.floor((durS % 3600) / 60);
  const s = durS % 60;
  const durationFormatted = h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;

  // Avg pace from duration and distance
  let avgPacePerKm = row.avg_pace ?? '';
  if (!avgPacePerKm && row.duration_seconds && row.distance_meters) {
    const paceSecPerKm = (row.duration_seconds / row.distance_meters) * 1000;
    const pm = Math.floor(paceSecPerKm / 60);
    const ps = Math.round(paceSecPerKm % 60);
    avgPacePerKm = `${pm}:${ps.toString().padStart(2, '0')}`;
  }

  // Cadence (steps/min)
  const avgRunCadence = raw.averageRunningCadenceInStepsPerMinute as number | null;

  // Stride length
  const avgStrideLength = raw.avgStrideLength as number | null;
  const strideCm = avgStrideLength ? Math.round(avgStrideLength * 10) / 10 : null;

  // Ground contact time
  const avgGroundContactTime = raw.avgGroundContactTime as number | null;

  // Vertical oscillation
  const avgVerticalOscillation = raw.avgVerticalOscillation as number | null;
  const vertOscCm = avgVerticalOscillation ? Math.round(avgVerticalOscillation * 10) / 10 : null;

  // Vertical ratio
  const avgVerticalRatio = raw.avgVerticalRatio as number | null;
  const vertRatioPct = avgVerticalRatio ? Math.round(avgVerticalRatio * 10) / 10 : null;

  // Power
  const avgPower = raw.avgPower as number | null;

  // Training load (Epoc)
  const activityTrainingLoad = raw.activityTrainingLoad as number | null;
  const trainingLoad = activityTrainingLoad ? Math.round(activityTrainingLoad * 10) / 10 : null;

  // Training effect
  const aerobicEffect = raw.aerobicTrainingEffect as number | null;
  const aerobicLabelRaw = raw.aerobicTrainingEffectMessage as string | null;
  let trainingEffect: string | null = null;
  if (aerobicLabelRaw && aerobicEffect != null) {
    // Strip numeric suffix (_1, _7, etc.) and convert UPPER_SNAKE_CASE to Title Case
    const stripped = aerobicLabelRaw.replace(/_\d+$/, '');
    const titleCase = stripped
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const roundedEffect = Math.round(aerobicEffect * 10) / 10;
    trainingEffect = `${titleCase} (Aerobic ${roundedEffect})`;
  } else if (aerobicLabelRaw) {
    trainingEffect = aerobicLabelRaw;
  }

  // VO2 Max
  const vo2Max = raw.vO2MaxValue as number | null;

  // Elevation
  const elevGain = raw.elevationGain as number | null;
  const elevGainM = elevGain ? Math.round(elevGain * 10) / 10 : null;

  // Fastest km pace — find the full-km lap with fastest pace
  let fastestKmPace: string | null = null;
  if (enriched.splits.length > 0) {
    const fullKmSplits = enriched.splits.filter((s) => s.distanceMeters >= 900);
    if (fullKmSplits.length > 0) {
      const fastestSplit = fullKmSplits.reduce((best, s) => {
        const paceS = s.durationSeconds / s.distanceMeters;
        const bestPace = best.durationSeconds / best.distanceMeters;
        return paceS < bestPace ? s : best;
      });
      fastestKmPace = `Km ${fastestSplit.lapIndex} -- ${fastestSplit.pacePerKm} /km`;
    }
  }

  // HR zones from raw_json
  const hrZones = raw.heartRateZones as { zoneNumber: number; secsInZone: number }[] | null;
  const getZone = (n: number) => hrZones?.find((z) => z.zoneNumber === n)?.secsInZone ?? null;

  return {
    garminId: row.activity_id,
    name: (raw.activityName as string) ?? 'Jakarta Running',
    date: wibDate,
    distanceKm,
    durationFormatted,
    avgPacePerKm,
    avgHr: row.avg_hr,
    maxHr: (raw.maxHR as number) ?? null,
    calories: row.calories,
    cadenceSpm: avgRunCadence ? Math.round(avgRunCadence) : null,
    strideCm,
    gctMs: avgGroundContactTime,
    vertOscCm,
    vertRatioPct,
    avgPowerW: avgPower ? Math.round(avgPower) : null,
    trainingLoad,
    trainingEffect,
    vo2Max: vo2Max ? Math.round(vo2Max) : null,
    elevGainM,
    fastestKmPace,
    location: (raw.locationName as string) || extractLocationFromName((raw.activityName as string) ?? '') || 'Jakarta',
    tempC: enriched.weather.tempC,
    feelsLikeC: enriched.weather.feelsLikeC,
    humidityPct: enriched.weather.humidity,
    weather: enriched.weather.description,
    perfCondition: enriched.perfCondition,
    decouplingPct: enriched.decouplingPct,
    hrZ1s: getZone(1),
    hrZ2s: getZone(2),
    hrZ3s: getZone(3),
    hrZ4s: getZone(4),
    hrZ5s: getZone(5),
    splits: enriched.splits,
  };
}

export interface RunningAnalysisOptions {
  date?: string;           // Override week date (YYYY-MM-DD) — defaults to previous week
  analysisOnly?: boolean;  // Skip data ingestion, only run analysis
  forceResync?: boolean;   // Re-write to Notion even if Garmin ID already exists
}

export interface RunningAnalysisResult {
  weekStart: string;
  weekEnd: string;
  activitiesFound: number;
  activitiesIngested: number;
  activitiesSkipped: number;
  analysisGenerated: boolean;
  weeklyInsightUpdated: boolean;
  dashboardUpdated: boolean;
  errors: string[];
  timestamp: string;
}

export async function runRunningAnalysis(options: RunningAnalysisOptions = {}): Promise<RunningAnalysisResult> {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) throw new Error('NOTION_API_KEY not configured');

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
  let dashboardUpdated = false;

  // --- Step 1: Query Supabase for outdoor runs in this week ---
  // Include +/- 1 day buffer to catch UTC/WIB boundary edge cases
  const queryStart = new Date(`${weekStart}T00:00:00+07:00`).toISOString();
  const queryEnd = new Date(`${weekEnd}T23:59:59+07:00`).toISOString();

  const { data: activities, error: dbError } = await supabase
    .from('garmin_activities')
    .select('activity_id, activity_type, distance_meters, duration_seconds, avg_pace, avg_hr, calories, started_at, raw_json')
    .gte('started_at', queryStart)
    .lte('started_at', queryEnd)
    .order('started_at', { ascending: true });

  if (dbError) {
    throw new Error(`Supabase query failed: ${dbError.message}`);
  }

  const outdoorRuns = (activities ?? []).filter((a) => isOutdoorRun(a.activity_type));
  const activitiesFound = outdoorRuns.length;

  // --- Step 2: Data ingestion (unless analysis_only) ---
  if (!options.analysisOnly && activitiesFound > 0) {
    // Get existing Garmin IDs from Notion Runs DB
    const existingIds = await getExistingGarminIds(notionApiKey);

    for (const row of outdoorRuns as GarminActivityRow[]) {
      if (!options.forceResync && existingIds.has(row.activity_id)) {
        activitiesSkipped++;
        console.log(`[running-analysis] Skipping ${row.activity_id} — already in Notion`);
        continue;
      }

      try {
        // Enrich from Garmin API
        console.log(`[running-analysis] Enriching activity ${row.activity_id}`);
        const enriched = await enrichActivity(row.activity_id);

        // Build RunActivity object
        const runActivity = extractRunActivity(row, enriched);

        // Write to Notion Runs DB — patch if exists (force_resync), create if new
        if (options.forceResync) {
          const existingPageId = await findRunPageByGarminId(notionApiKey, row.activity_id);
          if (existingPageId) {
            await patchRunPage(notionApiKey, existingPageId, runActivity);
            console.log(`[running-analysis] Patched existing Notion page for ${row.activity_id}`);
          } else {
            await createRunPage(notionApiKey, runActivity);
            console.log(`[running-analysis] Created Notion page for ${row.activity_id}`);
          }
        } else {
          await createRunPage(notionApiKey, runActivity);
          console.log(`[running-analysis] Created Notion page for ${row.activity_id}`);
        }
        activitiesIngested++;
        console.log(`[running-analysis] Created Notion page for ${row.activity_id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Activity ${row.activity_id}: ${msg}`);
        console.error(`[running-analysis] Error processing ${row.activity_id}:`, msg);
      }
    }
  }

  // --- Step 3: Generate weekly analysis ---
  try {
    // Fetch all runs for this week from Notion (includes newly added ones)
    const notionRunPages = await getRunsForPeriod(notionApiKey, weekStart, weekEnd);
    const thisWeekRuns = extractRunSummaries(notionRunPages);

    // Build historical context from ALL runs before this week
    let historicalContext: HistoricalContext | null = null;
    try {
      // Fetch all runs before this week for context
      const allPreviousPages = await getRunsForPeriod(notionApiKey, '2026-01-01', weekStart);
      const prevRuns = extractRunSummaries(allPreviousPages.filter((p) => {
        const dateProp = (p.properties as Record<string, unknown>)?.['Date'];
        const d = (dateProp as { date?: { start: string } })?.date?.start;
        return d && d < weekStart;
      }));

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

    const analysis = await generateWeeklyAnalysis(weekStart, weekEnd, thisWeekRuns, historicalContext);
    analysisGenerated = true;

    // --- Step 4: Upsert to Weekly Insights DB ---
    try {
      await upsertWeeklyInsight(notionApiKey, analysis);
      weeklyInsightUpdated = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Weekly Insights DB: ${msg}`);
    }

    // --- Step 5: Update Running Log dashboard ---
    try {
      // Get total run count across all time
      const allPages = await getRunsForPeriod(notionApiKey, '2026-01-01', weekEnd);
      const totalRuns = allPages.length;

      const dashResult = await updateRunningLogDashboard(notionApiKey, analysis, totalRuns);
      dashboardUpdated = dashResult.updated;
      if (!dashResult.updated) {
        errors.push(`Dashboard: ${dashResult.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Dashboard update: ${msg}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Analysis: ${msg}`);
    console.error('[running-analysis] Analysis failed:', msg);
  }

  return {
    weekStart,
    weekEnd,
    activitiesFound,
    activitiesIngested,
    activitiesSkipped,
    analysisGenerated,
    weeklyInsightUpdated,
    dashboardUpdated,
    errors,
    timestamp: new Date().toISOString(),
  };
}

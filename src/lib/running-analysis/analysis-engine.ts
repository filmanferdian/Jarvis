/**
 * Weekly running analysis engine.
 * Uses Claude API to generate 4-section analysis: how was this week,
 * what's good, what needs work, and what to focus on next.
 *
 * Plan-aware: the prompt judges each run on three lenses —
 * (a) plan adherence vs Supabase program_schedule, (b) continuity with
 * last week's Focus Next Week, (c) progression-in-context (form/efficiency
 * + like-for-like pace), rather than raw pace vs historical average.
 */

import { sanitizeMultiline, wrapUntrusted, UNTRUSTED_PREAMBLE } from '@/lib/promptEscape';
import type { PlannedDay } from './plan-loader';
import type { WeeklyInsightEntry } from './weekly-insights-db';
import { parseLapsFromProperty, type LapData } from './garmin-enrich';

export interface PlanContext {
  lastWeek: PlannedDay[];
  thisWeek: PlannedDay[];
  nextWeek: PlannedDay[];
  cardioProtocolMd: string;
  planAdherenceStartDate: string;
}

export interface WeeklyRunSummary {
  date: string;
  name: string;
  distanceKm: number;
  durationFormatted: string;
  avgPacePerKm: string;
  avgHr: number | null;
  maxHr: number | null;
  trainingLoad: number | null;
  trainingEffect: string | null;
  vo2Max: number | null;
  perfCondition: number | null;
  decouplingPct: number | null;
  tempC: number | null;
  humidityPct: number | null;
  weather: string | null;
  cadenceSpm: number | null;
  avgPowerW: number | null;
  elevGainM: number | null;
  /** Authoritative session-type label from segment composition. */
  sessionProfile: string | null;
  /** Per-lap structured data parsed from the Notion Lap Profile property. */
  laps: LapData[];
}

export interface HistoricalContext {
  avgPacePerKm: string;
  avgHr: number | null;
  avgDistanceKm: number;
  totalRuns: number;
  periodLabel: string; // e.g. "Feb–Mar 2026"
}

export interface WeeklyAnalysis {
  weekLabel: string; // e.g. "Week of 24–30 Mar 2026"
  weekStart: string;
  weekEnd: string;
  runsLogged: number;
  totalDistanceKm: number;
  totalDurationMins: number;
  avgPacePerKm: string;
  avgHr: number | null;
  avgCadenceSpm: number | null;
  totalTrainingLoad: number;
  howWasThisWeek: string;
  whatsGood: string;
  whatNeedsWork: string;
  focusNextWeek: string;
  generatedAt: string;
}

/** Distance-weighted average cadence across runs. Returns null if no cadence data. */
export function weightedAvgCadence(runs: WeeklyRunSummary[]): number | null {
  const eligible = runs.filter((r) => r.cadenceSpm != null && r.distanceKm > 0);
  if (eligible.length === 0) return null;
  const totalDist = eligible.reduce((s, r) => s + r.distanceKm, 0);
  if (totalDist === 0) return null;
  const weighted = eligible.reduce((s, r) => s + (r.cadenceSpm as number) * r.distanceKm, 0);
  return Math.round(weighted / totalDist);
}

function extractPropText(page: Record<string, unknown>, prop: string): string | null {
  const p = (page.properties as Record<string, unknown>)?.[prop];
  const richText = (p as { rich_text?: { plain_text: string }[] })?.rich_text;
  return richText?.[0]?.plain_text ?? null;
}

function extractPropNumber(page: Record<string, unknown>, prop: string): number | null {
  const p = (page.properties as Record<string, unknown>)?.[prop];
  return (p as { number?: number })?.number ?? null;
}

function extractPropDate(page: Record<string, unknown>): string | null {
  const p = (page.properties as Record<string, unknown>)?.['Date'];
  return (p as { date?: { start: string } })?.date?.start ?? null;
}

function extractPropTitle(page: Record<string, unknown>): string {
  const p = (page.properties as Record<string, unknown>)?.['Run'];
  const title = (p as { title?: { plain_text: string }[] })?.title;
  return title?.[0]?.plain_text ?? 'Unnamed Run';
}

function durationStringToSeconds(dur: string | null): number {
  if (!dur) return 0;
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function secondsToMins(s: number): number {
  return Math.round(s / 60);
}

export function extractRunSummaries(pages: Record<string, unknown>[]): WeeklyRunSummary[] {
  return pages.map((page) => ({
    date: extractPropDate(page) ?? '',
    name: extractPropTitle(page),
    distanceKm: extractPropNumber(page, 'Distance (km)') ?? 0,
    durationFormatted: extractPropText(page, 'Duration') ?? '',
    avgPacePerKm: extractPropText(page, 'Avg Pace') ?? '',
    avgHr: extractPropNumber(page, 'Avg HR'),
    maxHr: extractPropNumber(page, 'Max HR'),
    trainingLoad: extractPropNumber(page, 'Training Load'),
    trainingEffect: extractPropText(page, 'Training Effect'),
    vo2Max: extractPropNumber(page, 'VO2 Max'),
    perfCondition: extractPropNumber(page, 'Perf Condition'),
    decouplingPct: extractPropNumber(page, 'Decoupling (%)'),
    tempC: extractPropNumber(page, 'Temp (C)'),
    humidityPct: extractPropNumber(page, 'Humidity (%)'),
    weather: extractPropText(page, 'Weather'),
    cadenceSpm: extractPropNumber(page, 'Cadence (spm)'),
    avgPowerW: extractPropNumber(page, 'Avg Power (W)'),
    elevGainM: extractPropNumber(page, 'Elev Gain (m)'),
    sessionProfile: extractPropText(page, 'Session Profile'),
    laps: parseLapsFromProperty(extractPropText(page, 'Lap Profile')),
  }));
}

function avgPace(runs: WeeklyRunSummary[]): string {
  const paces = runs.map((r) => {
    const [m, s] = r.avgPacePerKm.split(':').map(Number);
    return m * 60 + (s || 0);
  }).filter((p) => p > 0);
  if (paces.length === 0) return '--:--';
  const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
  const mins = Math.floor(avg / 60);
  const secs = Math.round(avg % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function avgNumber(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export async function generateWeeklyAnalysis(
  weekStart: string,
  weekEnd: string,
  thisWeekRuns: WeeklyRunSummary[],
  historicalContext: HistoricalContext | null,
  previousWeekInsight: WeeklyInsightEntry | null = null,
  planContext: PlanContext | null = null,
  today: string | null = null,
): Promise<WeeklyAnalysis> {
  const apiKey = (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!;
  if (!apiKey) throw new Error('JARVIS_ANTHROPIC_KEY not configured');

  const totalDistanceKm = Math.round(thisWeekRuns.reduce((s, r) => s + r.distanceKm, 0) * 100) / 100;
  const totalDurationSec = thisWeekRuns.reduce((s, r) => s + durationStringToSeconds(r.durationFormatted), 0);
  const totalDurationMins = secondsToMins(totalDurationSec);
  const weekAvgPace = avgPace(thisWeekRuns);
  const weekAvgHr = avgNumber(thisWeekRuns.map((r) => r.avgHr));
  const weekAvgCadence = weightedAvgCadence(thisWeekRuns);
  const totalLoad = Math.round(thisWeekRuns.reduce((s, r) => s + (r.trainingLoad ?? 0), 0) * 10) / 10;

  // Format date range for label
  const startD = new Date(weekStart);
  const endD = new Date(weekEnd);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekLabel = `${startD.getDate()} ${months[startD.getMonth()]} – ${endD.getDate()} ${months[endD.getMonth()]} ${endD.getFullYear()}`;

  if (thisWeekRuns.length === 0) {
    return {
      weekLabel,
      weekStart,
      weekEnd,
      runsLogged: 0,
      totalDistanceKm: 0,
      totalDurationMins: 0,
      avgPacePerKm: '--:--',
      avgHr: null,
      avgCadenceSpm: null,
      totalTrainingLoad: 0,
      howWasThisWeek: 'No outdoor runs recorded this week.',
      whatsGood: 'N/A',
      whatNeedsWork: 'Get out and run this week!',
      focusNextWeek: 'Aim for at least 2 outdoor runs.',
      generatedAt: new Date().toISOString(),
    };
  }

  // Build runs detail for Claude, matching each actual run to its planned session by date.
  const planByDate = new Map<string, PlannedDay>();
  if (planContext) {
    for (const day of planContext.thisWeek) planByDate.set(day.date, day);
  }

  const runsDetail = thisWeekRuns.map((r, i) => {
    const planned = planByDate.get(r.date);
    const plannedLine = planned ? ` | planned: ${planned.cardio}` : '';
    const lines = [
      `Run ${i + 1} (${r.date}${plannedLine}): ${r.distanceKm}km in ${r.durationFormatted} @ ${r.avgPacePerKm}/km`,
      `  Session profile: ${r.sessionProfile ?? 'unclassified (treat as Z2 base unless lap data says otherwise)'}`,
      r.avgHr != null ? `  HR: avg ${r.avgHr} / max ${r.maxHr}` : null,
      r.trainingLoad != null ? `  Training load: ${r.trainingLoad}` : null,
      r.trainingEffect ? `  Training effect: ${r.trainingEffect}` : null,
      r.perfCondition != null ? `  Perf condition: ${r.perfCondition > 0 ? '+' : ''}${r.perfCondition}` : null,
      r.decouplingPct != null ? `  Decoupling: ${r.decouplingPct}%` : null,
      r.vo2Max != null ? `  VO2 Max: ${r.vo2Max}` : null,
      r.cadenceSpm != null ? `  Cadence: ${r.cadenceSpm} spm (activity-level avg, may be diluted by warm-up/rest)` : null,
      r.avgPowerW != null ? `  Power: ${r.avgPowerW}W` : null,
      r.weather ? `  Weather: ${r.weather}, ${r.tempC}°C, ${r.humidityPct}% humidity` : null,
    ].filter(Boolean);

    if (r.laps.length > 0) {
      lines.push('  Laps:');
      const lapsToShow = r.laps.slice(0, 30); // defensive cap
      for (const l of lapsToShow) {
        const distKm = (l.d / 1000).toFixed(2);
        const durMin = Math.floor(l.du / 60);
        const durSec = String(l.du % 60).padStart(2, '0');
        const paceStr = l.p != null ? `${Math.floor(l.p / 60)}:${String(l.p % 60).padStart(2, '0')}/km` : '—';
        const hrStr = l.hr != null ? `HR ${l.hr}` : 'HR —';
        lines.push(`    L${l.i} [${l.t}] ${distKm}km in ${durMin}:${durSec} @ ${paceStr}, ${hrStr}`);
      }
    }

    return lines.join('\n');
  }).join('\n\n');

  const historicalNote = historicalContext
    ? `Historical context (${historicalContext.periodLabel}, ${historicalContext.totalRuns} runs):
- Avg pace: ${historicalContext.avgPacePerKm}/km
- Avg HR: ${historicalContext.avgHr ?? 'N/A'}
- Avg distance: ${historicalContext.avgDistanceKm}km per run`
    : 'No historical data available for comparison.';

  // --- Optional plan-awareness blocks ---

  function formatPlannedDays(days: PlannedDay[]): string {
    return days
      .map((d) => {
        const deload = d.deload ? ' (DELOAD)' : '';
        const train = d.training ? `, training='${d.training}'` : '';
        return `${d.dayOfWeek} ${d.date}${deload}: cardio='${d.cardio}'${train}`;
      })
      .join('\n');
  }

  const lastWeekBlock = planContext && planContext.lastWeek.length > 0
    ? `

LAST WEEK'S PLAN (session-intent context only — for interpreting any prior-week reference in continuity, NOT for grading carry-overs or completeness):
${wrapUntrusted('untrusted_last_week_plan', sanitizeMultiline(formatPlannedDays(planContext.lastWeek), 3000))}`
    : '';

  const planBlock = planContext && planContext.thisWeek.length > 0
    ? `
THIS WEEK'S PLAN (SESSION-INTENT CONTEXT ONLY). Week ${planContext.thisWeek[0].week}, ${planContext.thisWeek[0].phase}:
${wrapUntrusted('untrusted_week_plan', sanitizeMultiline(formatPlannedDays(planContext.thisWeek), 3000))}
${lastWeekBlock}

NEXT WEEK'S PLAN (used in FOCUS NEXT WEEK to preview what's coming — e.g. VO2 max starting, tempo duration bump, Sat long-run distance change):
${wrapUntrusted('untrusted_next_week_plan', sanitizeMultiline(formatPlannedDays(planContext.nextWeek), 3000))}

INTENSITY PROTOCOL (used to interpret zone names — Z2 HR target, tempo = Z3/Z4, VO2 max format):
${wrapUntrusted('untrusted_protocol', sanitizeMultiline(planContext.cardioProtocolMd, 6000))}

HOW TO USE THE PLAN: the plan tells you what each completed run was MEANT to be (Z2, tempo, VO2, long run, recovery) so you can judge execution quality on its own terms. The plan is NOT a grading rubric. Do NOT compare the actual session list to the planned session list. Do NOT count "missed" sessions, "extra" sessions, or "substituted" sessions. Do NOT comment on whether the planned mix was delivered. Adherence to the schedule is the runner's concern, not yours. Pre-${planContext.planAdherenceStartDate} historical data is a weak baseline for pace/HR comparisons (loose-program era).`
    : '';

  const continuityBlock = previousWeekInsight
    ? `
LAST WEEK'S SYNTHESIS (${previousWeekInsight.weekLabel}) — context only, do not grade week-over-week adherence:
- Focus set for this week: ${wrapUntrusted('untrusted_prior_focus', sanitizeMultiline(previousWeekInsight.focusNextWeek, 1500))}
- Weaknesses flagged: ${wrapUntrusted('untrusted_prior_gaps', sanitizeMultiline(previousWeekInsight.whatNeedsWork, 1500))}`
    : '';

  // --- Timing block: tells the model whether the week is complete or still in-flight ---
  const todayDate = today ?? new Date().toISOString().split('T')[0];
  const isWeekComplete = todayDate > weekEnd;
  const daysRemaining = (() => {
    if (isWeekComplete) return 0;
    const t = new Date(`${todayDate}T00:00:00Z`).getTime();
    const e = new Date(`${weekEnd}T00:00:00Z`).getTime();
    return Math.max(0, Math.round((e - t) / 86400000));
  })();
  const timingBlock = isWeekComplete
    ? `\nTIMING: today is ${todayDate}. The week ${weekStart} → ${weekEnd} is COMPLETE. Judge against the full plan.`
    : `\nTIMING: today is ${todayDate}. The week ${weekStart} → ${weekEnd} is IN PROGRESS — ${daysRemaining} day(s) remain (${todayDate} through ${weekEnd}). Sessions on dates AFTER ${todayDate} have not happened yet. Do NOT flag them as missed. Only judge what was planned for ${weekStart} through ${todayDate}.`;

  const prompt = `${UNTRUSTED_PREAMBLE}

You are a running coach analyzing outdoor running sessions for a recreational runner in Jakarta, Indonesia.

The runner follows a structured program that ramps up over time — starting with a few runs per week and building toward ~5 Z2 runs plus VO2 max intervals at steady state. Different sessions target different intensities; Z2 runs are intentionally slow (target HR is in the protocol). Do NOT treat a slower pace on a Z2 day as regression.

WALKING IS OUT OF SCOPE. This analysis is for running only. Treat any walk-only or treadmill-walking activity (typical signal: avg pace slower than 10:00/km with no run intervals, or an activity named "Walking" / "Treadmill Walking") as not-a-running-session. Do NOT include walks in the run count, do NOT credit them toward Z2 volume, do NOT mention them in the prose. Walks are filtered out of the data feed by ingestion in normal cases — this rule is a safety net.

Your job: judge this week on a SINGLE lens — PROGRESSION IN CONTEXT. Look at form & efficiency (cadence, decoupling, HR drift, stride, GCT, vertical ratio, training effect, VO2 Max) AND like-for-like pace (pace at a given HR on Z2 days, tempo pace on tempo days, VO2 interval pace on VO2 days). Never compare raw weekly average pace across mixed session types.

ADHERENCE IS NOT YOUR LENS. The runner manages their own schedule. You are NOT evaluating whether the planned mix was delivered, whether sessions were missed, substituted, moved between days, or carried across weeks. The plan is provided ONLY so you can interpret what each completed run was meant to be (Z2 vs tempo vs VO2 vs long run) when judging execution quality.

USE THE LAP-LEVEL DATA. Each run carries a Session profile (one-line classification) and a per-lap breakdown (one row per lap with segment type, pace, HR, duration). The Session profile is the AUTHORITATIVE label for what kind of session each run was — if it says "VO2 max intervals: 4×4min @ Z5", trust it. Do NOT infer session type from activity-level avg pace or avg cadence; those are diluted by warm-up, cool-down, and rest segments in any structured workout, and will mislead you.

When citing numbers, prefer LAP-level data over activity-level when the lap data is more telling:
- VO2 max sessions: cite work-interval pace + HR + their consistency (drift across reps), not the activity-level average. Example: "intervals 1–2 hit 4:25/km @ 178 HR cleanly; the third dropped to 4:38 @ 168 — fade in the back half" beats "avg pace 11:32/km @ 145 HR".
- Tempo / long-run hybrids: cite the tempo segment(s) explicitly. Example: "tempo finish at 5:30/km @ 158 HR" beats "avg pace 7:10/km".
- Long runs: comment on decoupling between earlier and later main laps when the lap HR/pace shows drift. The activity-level Decoupling % is one signal; lap-by-lap progression is more granular.
- Z2 base runs: cite pace-at-HR like-for-like vs prior comparable Z2 runs (compare main laps only, ignore warm-up/cool-down).
${timingBlock}
${planBlock}${continuityBlock}

Week analyzed: ${weekLabel}
Sessions completed: ${thisWeekRuns.length}
Total distance: ${totalDistanceKm}km
Total time: ${totalDurationMins} mins
Average pace: ${weekAvgPace}/km
Average HR: ${weekAvgHr ?? 'N/A'}
Total training load: ${totalLoad}

Individual runs:
${runsDetail}

${historicalNote}
Note: historical averages span both loose and plan-adherent periods. Use history to judge form/efficiency trends and like-for-like pace trends by session type — never raw average pace vs history.

Write a concise analysis in 4 sections. Use plain prose (no markdown headers or bullet points). Be specific and data-driven. Reference actual numbers. Acknowledge Jakarta heat/humidity when it's a relevant factor.

Section 1 — HOW WAS THIS WEEK (2-3 sentences): Lead with the SHARPEST progression signal from the runs that DID happen — a like-for-like pace improvement at the same HR, a clear cadence step-up, a decoupling reading on a long run, a tempo split, a VO2 interval read. Cite specific numbers (HR at Z2 pace, tempo split, VO2 interval pace, decoupling%, cadence). NEVER comment on what was/wasn't done versus the plan. If the week is in progress, frame as a mid-week read on completed sessions only. Generic praise like "solid week" without a number is wasted prose.

Section 2 — WHAT'S GOOD (2-3 sentences): Progression wins from the actual runs: form/efficiency trending well, like-for-like pace improvements, well-executed sessions at their intended intensity. Cite numbers.

Section 3 — WHAT NEEDS WORK (2-3 sentences): Execution gaps observable in the actual runs only: ran Z2 too hot (HR above target on a Z2 session), cadence below target on a Z2 session, high decoupling on a long run, poor tempo execution, inconsistent VO2 intervals, pace-at-same-HR worse than a prior comparable session of the same type. EXPLICIT BANS: do NOT flag missed sessions, off-plan substitutions, day-of-week shifts, weekly volume vs plan, deviation from prescribed walk/rest days, or anything related to schedule adherence. If the runs that happened look fine on execution, say so in one sentence — do NOT manufacture concerns to fill the section.

Section 4 — FOCUS NEXT WEEK (2-3 sentences): Forward-looking cues for next week's planned sessions, referencing NEXT WEEK'S PLAN (HR range, duration, session types) plus one or two form/efficiency/pace-at-HR targets carried over from any execution gaps in Section 3. Do NOT use this section to relitigate this-week adherence.

Respond in this exact JSON format:
{
  "howWasThisWeek": "...",
  "whatsGood": "...",
  "whatNeedsWork": "...",
  "focusNextWeek": "..."
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const claudeData = await res.json();
  const text = claudeData.content?.[0]?.text ?? '{}';

  // Track usage
  try {
    const { trackServiceUsage } = await import('@/lib/rateLimit');
    await trackServiceUsage('claude', {
      tokens_input: claudeData.usage?.input_tokens ?? 0,
      tokens_output: claudeData.usage?.output_tokens ?? 0,
    });
  } catch { /* non-critical */ }

  let analysis = { howWasThisWeek: '', whatsGood: '', whatNeedsWork: '', focusNextWeek: '' };
  try {
    // Extract JSON from response (may have surrounding text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    }
  } catch {
    analysis.howWasThisWeek = text.slice(0, 300);
  }

  return {
    weekLabel,
    weekStart,
    weekEnd,
    runsLogged: thisWeekRuns.length,
    totalDistanceKm,
    totalDurationMins,
    avgPacePerKm: weekAvgPace,
    avgHr: weekAvgHr,
    avgCadenceSpm: weekAvgCadence,
    totalTrainingLoad: totalLoad,
    howWasThisWeek: analysis.howWasThisWeek || 'Analysis unavailable.',
    whatsGood: analysis.whatsGood || 'N/A',
    whatNeedsWork: analysis.whatNeedsWork || 'N/A',
    focusNextWeek: analysis.focusNextWeek || 'N/A',
    generatedAt: new Date().toISOString(),
  };
}

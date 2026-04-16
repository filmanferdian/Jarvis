/**
 * Weekly running analysis engine.
 * Uses Claude API to generate 4-section analysis: how was this week,
 * what's good, what needs work, and what to focus on next.
 */

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
  historicalContext: HistoricalContext | null
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

  // Build runs detail for Claude
  const runsDetail = thisWeekRuns.map((r, i) => {
    const lines = [
      `Run ${i + 1} (${r.date}): ${r.distanceKm}km in ${r.durationFormatted} @ ${r.avgPacePerKm}/km`,
      r.avgHr != null ? `  HR: avg ${r.avgHr} / max ${r.maxHr}` : null,
      r.trainingLoad != null ? `  Training load: ${r.trainingLoad}` : null,
      r.trainingEffect ? `  Training effect: ${r.trainingEffect}` : null,
      r.perfCondition != null ? `  Perf condition: ${r.perfCondition > 0 ? '+' : ''}${r.perfCondition}` : null,
      r.decouplingPct != null ? `  Decoupling: ${r.decouplingPct}%` : null,
      r.vo2Max != null ? `  VO2 Max: ${r.vo2Max}` : null,
      r.cadenceSpm != null ? `  Cadence: ${r.cadenceSpm} spm` : null,
      r.avgPowerW != null ? `  Power: ${r.avgPowerW}W` : null,
      r.weather ? `  Weather: ${r.weather}, ${r.tempC}°C, ${r.humidityPct}% humidity` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');

  const historicalNote = historicalContext
    ? `Historical context (${historicalContext.periodLabel}, ${historicalContext.totalRuns} runs):
- Avg pace: ${historicalContext.avgPacePerKm}/km
- Avg HR: ${historicalContext.avgHr ?? 'N/A'}
- Avg distance: ${historicalContext.avgDistanceKm}km per run`
    : 'No historical data available for comparison.';

  const prompt = `You are a running coach analyzing outdoor running sessions for a recreational runner in Jakarta, Indonesia.

Context: This runner follows a structured weekly program that includes strength training and daily walks alongside running. The running data below represents their 2 dedicated outdoor running sessions per week — that is the full intended schedule, not a sign of low volume. Do not comment on run frequency or suggest running more often.

Your job is to assess running performance quality and identify how the runner can run better within their 2-session-per-week structure.

Week: ${weekLabel}
Sessions: ${thisWeekRuns.length}
Total distance: ${totalDistanceKm}km
Total time: ${totalDurationMins} mins
Average pace: ${weekAvgPace}/km
Average HR: ${weekAvgHr ?? 'N/A'}
Total training load: ${totalLoad}

Individual runs:
${runsDetail}

${historicalNote}

Write a concise analysis in 4 sections. Use plain prose (no markdown headers or bullet points). Be specific and data-driven. Reference the actual numbers. Acknowledge Jakarta heat/humidity when it's a relevant factor.

Section 1 — HOW WAS THIS WEEK (2-3 sentences): Quality of the running sessions — pace, effort, how the body responded. Not about how many runs were done.

Section 2 — WHAT'S GOOD (2-3 sentences): Specific performance positives from the data — pace trend, HR efficiency, form metrics, training effect.

Section 3 — WHAT NEEDS WORK (2-3 sentences): Running-specific weaknesses in the data — decoupling, cadence, pace consistency, HR drift, or similar.

Section 4 — FOCUS NEXT WEEK (2-3 sentences): Concrete cues or targets for the next 2 running sessions to improve performance. Be specific (e.g. target pace range, cadence target, effort level).

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

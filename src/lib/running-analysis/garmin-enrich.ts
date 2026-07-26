/**
 * Lap parsing, segment classification and decoupling maths for running activities.
 *
 * Pure transforms over Garmin API payloads — the fetching itself lives in
 * src/lib/sync/activityDetails.ts. `parseLapsFromProperty` survives for the Notion-exit
 * backfill script, which is the last reader of the old compact lap encoding.
 */

export type SegmentType =
  | 'warm-up'
  | 'main'
  | 'tempo'
  | 'interval-work'
  | 'interval-rest'
  | 'cool-down';

const SEGMENT_TYPES: readonly string[] = [
  'warm-up', 'main', 'tempo', 'interval-work', 'interval-rest', 'cool-down',
];

/** Narrows a stored `lap_detail[].segment` string back to SegmentType. */
export function isSegmentType(v: unknown): v is SegmentType {
  return typeof v === 'string' && SEGMENT_TYPES.includes(v);
}

export interface SplitData {
  lapIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  pacePerKm: string;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  strideCm: number | null;
  gctMs: number | null;
  powerW: number | null;
  vertOscCm: number | null;
  vertRatioPct: number | null;
  elevGain: number | null;
  elevLoss: number | null;
  /** Inferred from HR + pace heuristics; defaults to 'main' for uniform runs. */
  segmentType: SegmentType;
}

export function fToC(f: number | null): number | null {
  if (f == null) return null;
  return Math.round((f - 32) * 5 / 9 * 10) / 10;
}

function speedToPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return '--:--';
  const paceSecPerKm = 1000 / speedMs;
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Find descriptor index by key, checking both 'key' and 'metricsKey' field names */
export function findDescriptorIndex(
  descriptors: Record<string, unknown>[],
  keyName: string
): number {
  const idx = descriptors.findIndex(
    (d) => (d.key as string) === keyName || (d.metricsKey as string) === keyName
  );
  return idx;
}

export function calcDecoupling(
  metricDescriptors: Record<string, unknown>[],
  activityDetailMetrics: { metrics: number[] }[]
): number | null {
  const tsIdx = findDescriptorIndex(metricDescriptors, 'directTimestamp');
  const hrIdx = findDescriptorIndex(metricDescriptors, 'directHeartRate');
  if (hrIdx === -1) {
    console.warn('[garmin-enrich] Decoupling: metricDescriptors did not contain directHeartRate');
    return null;
  }
  if (tsIdx === -1) {
    console.warn('[garmin-enrich] Decoupling: metricDescriptors did not contain directTimestamp');
    return null;
  }
  if (activityDetailMetrics.length < 4) {
    console.warn(`[garmin-enrich] Decoupling: activityDetailMetrics too short (${activityDetailMetrics.length})`);
    return null;
  }

  // Collect data points with valid HR and timestamp
  const allDataPoints = activityDetailMetrics
    .map((m) => ({
      ts: m.metrics[tsIdx],
      hr: m.metrics[hrIdx],
    }))
    .filter((p) => p.hr != null && p.hr > 0 && p.ts != null);

  if (allDataPoints.length < 10) {
    console.warn(`[garmin-enrich] Decoupling: only ${allDataPoints.length} valid data points`);
    return null;
  }

  // Exclude warmup period — HR ramps from resting, inflating first-half avg
  // For runs under 20 min, use 3 min warmup; otherwise 5 min
  const rawStartTs = allDataPoints[0].ts;
  const rawEndTs = allDataPoints[allDataPoints.length - 1].ts;
  const totalActivityDurationMs = rawEndTs - rawStartTs;
  const warmupMs = totalActivityDurationMs < 20 * 60 * 1000 ? 3 * 60 * 1000 : 5 * 60 * 1000;
  const dataPoints = allDataPoints.filter((p) => (p.ts - rawStartTs) >= warmupMs);

  if (dataPoints.length < 10) {
    console.warn(`[garmin-enrich] Decoupling: only ${dataPoints.length} valid data points after warmup exclusion`);
    return null;
  }

  // Calculate duration and 80% cutoff from post-warmup data
  const startTs = dataPoints[0].ts;
  const endTs = dataPoints[dataPoints.length - 1].ts;
  const totalDuration = endTs - startTs;
  const cutoff80 = startTs + totalDuration * 0.8;
  const midpoint40 = startTs + totalDuration * 0.4;

  // First half: 0-40% of duration, Second half: 40-80% of duration
  const firstHalf = dataPoints.filter((p) => p.ts >= startTs && p.ts < midpoint40);
  const secondHalf = dataPoints.filter((p) => p.ts >= midpoint40 && p.ts < cutoff80);

  if (firstHalf.length === 0 || secondHalf.length === 0) {
    console.warn('[garmin-enrich] Decoupling: empty half after timestamp split');
    return null;
  }

  const avgHrFirst = firstHalf.reduce((s, p) => s + p.hr, 0) / firstHalf.length;
  const avgHrSecond = secondHalf.reduce((s, p) => s + p.hr, 0) / secondHalf.length;

  if (avgHrFirst === 0) return null;

  const decoupling = ((avgHrSecond - avgHrFirst) / avgHrFirst) * 100;
  return Math.round(decoupling * 10) / 10;
}

export function extractPerfCondition(
  metricDescriptors: Record<string, unknown>[],
  activityDetailMetrics: { metrics: number[] }[]
): number | null {
  const idx = findDescriptorIndex(metricDescriptors, 'directPerformanceCondition');
  if (idx === -1) {
    console.warn('[garmin-enrich] PerfCondition: metricDescriptors did not contain directPerformanceCondition');
    return null;
  }

  // Find last non-null, non-zero value (stabilized score)
  for (let i = activityDetailMetrics.length - 1; i >= 0; i--) {
    const val = activityDetailMetrics[i].metrics[idx];
    if (val !== null && val !== undefined && val !== 0) {
      return val;
    }
  }
  console.warn('[garmin-enrich] PerfCondition: no non-zero value found in activityDetailMetrics');
  return null;
}

// ---------------------------------------------------------------------------
// Lap segment classification
//
// Free-form runs use manual lap presses to mark transitions (Z2 → tempo,
// warm-up → interval → rest → ...). Garmin doesn't expose lap intent on
// /splits, so we infer segment type from HR + pace relative to the run's
// main-effort baseline.
//
// Design priorities:
//  1. Backward compatible — uniform Z2 runs classify entirely as 'main'.
//  2. Conservative — only escalate when multiple signals agree.
//  3. Single pass; mutates in place; ordering matters (warm-up/cool-down
//     first, then tempo trailing-window, then interval alternation).
// ---------------------------------------------------------------------------

const MIN_SEGMENT_DURATION_S = 60;
const WARM_COOL_HR_DELTA = 15;          // bpm below median main HR
const WARM_COOL_PACE_DELTA_S = 60;      // sec/km slower than median
const WARM_COOL_MAX_DURATION_S = 12 * 60; // VO2 max warm-up jogs can run 8–10 min
const TEMPO_HR_FLOOR = 155;             // Z3 cap → tempo entry
const TEMPO_PACE_DELTA_S = 30;          // sec/km faster than median
const INTERVAL_WORK_HR_FLOOR = 160;     // Z4 entry
const INTERVAL_WORK_MAX_DURATION_S = 6 * 60;
const INTERVAL_REST_HR_CEIL = 150;      // Z3 cap (rest is below this)
const INTERVAL_REST_MAX_DURATION_S = 3 * 60;

/** Convert "M:SS" pace string to seconds per km. Returns Infinity on bad input
 *  so a missing pace can't accidentally win a min/median comparison. */
function paceStringToSec(pace: string): number {
  if (!pace || pace === '--:--') return Infinity;
  const [m, s] = pace.split(':').map(Number);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return Infinity;
  return m * 60 + s;
}

function median(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Median HR / pace from middle 60% of laps (trim 20% each end). Excludes
 *  likely warm-up/cool-down so they can't drag the baseline. With ≤3 laps,
 *  uses all so the baseline isn't empty. */
function computeBaseline(splits: SplitData[]): { medHr: number | null; medPaceS: number | null } {
  if (splits.length === 0) return { medHr: null, medPaceS: null };
  const window = splits.length <= 3
    ? splits
    : splits.slice(Math.floor(splits.length * 0.2), splits.length - Math.floor(splits.length * 0.2));
  return {
    medHr: median(window.map((s) => s.avgHr ?? NaN)),
    medPaceS: median(window.map((s) => paceStringToSec(s.pacePerKm))),
  };
}

export function classifyLaps(splits: SplitData[]): SplitData[] {
  // Initialize / reset to default
  for (const s of splits) s.segmentType = 'main';

  // Pure short run (1 lap or 0): nothing to classify.
  if (splits.length < 2) return splits;

  const { medHr, medPaceS } = computeBaseline(splits);
  if (medHr == null || medPaceS == null || !Number.isFinite(medPaceS)) {
    // No baseline — leave everything as 'main' (defensive default).
    return splits;
  }

  // Step 1: Warm-up (lap 1 or 2, earliest qualifier only)
  for (let i = 0; i < Math.min(2, splits.length); i++) {
    const s = splits[i];
    if (s.durationSeconds < MIN_SEGMENT_DURATION_S) continue;
    if (s.durationSeconds >= WARM_COOL_MAX_DURATION_S) continue;
    if (s.avgHr == null) continue;
    const paceS = paceStringToSec(s.pacePerKm);
    if (
      s.avgHr < medHr - WARM_COOL_HR_DELTA &&
      paceS > medPaceS + WARM_COOL_PACE_DELTA_S
    ) {
      s.segmentType = 'warm-up';
      break;
    }
  }

  // Step 2: Cool-down (last lap only)
  const last = splits[splits.length - 1];
  if (
    last.segmentType === 'main' &&
    last.durationSeconds >= MIN_SEGMENT_DURATION_S &&
    last.durationSeconds < WARM_COOL_MAX_DURATION_S &&
    last.avgHr != null &&
    last.avgHr < medHr - WARM_COOL_HR_DELTA &&
    paceStringToSec(last.pacePerKm) > medPaceS + WARM_COOL_PACE_DELTA_S
  ) {
    last.segmentType = 'cool-down';
  }

  // Step 3: Tempo (consecutive trailing laps before cool-down).
  // Walk backwards, marking qualifiers as 'tempo' until a non-qualifier
  // breaks the run.
  let endIdx = splits.length - 1;
  if (splits[endIdx].segmentType === 'cool-down') endIdx--;
  for (let i = endIdx; i >= 0; i--) {
    const s = splits[i];
    if (s.segmentType !== 'main') break;
    if (s.durationSeconds < MIN_SEGMENT_DURATION_S) break;
    if (s.avgHr == null) break;
    const paceS = paceStringToSec(s.pacePerKm);
    if (s.avgHr >= TEMPO_HR_FLOOR && paceS <= medPaceS - TEMPO_PACE_DELTA_S) {
      s.segmentType = 'tempo';
    } else {
      break;
    }
  }

  // Step 4: Intervals — must alternate work/rest with ≥2 work laps.
  // Two-pass: tag candidates, then verify alternation. If alternation fails,
  // revert so a single fast lap inside a Z2 run isn't mis-labeled.
  type Tag = 'work' | 'rest' | null;
  // Pace check intentionally omitted from work detection: in a VO2 max
  // session the rest laps drag the median pace toward work pace, so a
  // "faster than median" comparison fails. HR floor + short duration +
  // alternation are sufficient signals.
  const tags: Tag[] = splits.map((s) => {
    if (s.segmentType !== 'main') return null;
    if (s.durationSeconds < MIN_SEGMENT_DURATION_S) return null;
    if (s.avgHr == null) return null;
    if (
      s.avgHr >= INTERVAL_WORK_HR_FLOOR &&
      s.durationSeconds < INTERVAL_WORK_MAX_DURATION_S
    ) {
      return 'work';
    }
    if (
      s.avgHr < INTERVAL_REST_HR_CEIL &&
      s.durationSeconds < INTERVAL_REST_MAX_DURATION_S
    ) {
      return 'rest';
    }
    return null;
  });

  const workIdxs = tags.flatMap((t, i) => (t === 'work' ? [i] : []));
  if (workIdxs.length >= 2) {
    let alternates = true;
    for (let k = 0; k < workIdxs.length - 1; k++) {
      const between = tags.slice(workIdxs[k] + 1, workIdxs[k + 1]);
      if (between.length === 0 || between.length > 2 || !between.includes('rest')) {
        alternates = false;
        break;
      }
    }
    if (alternates) {
      for (let i = 0; i < splits.length; i++) {
        if (tags[i] === 'work') {
          splits[i].segmentType = 'interval-work';
        } else if (
          tags[i] === 'rest' &&
          i > workIdxs[0] &&
          i < workIdxs[workIdxs.length - 1]
        ) {
          splits[i].segmentType = 'interval-rest';
        }
      }
    }
  }

  return splits;
}

// ---------------------------------------------------------------------------
// Session profile
//
// Once classifyLaps() has labelled the splits, summarizeSegments() derives a
// one-line authoritative session-type label, persisted as
// garmin_activity_details.session_profile so the weekly-analysis prompt can
// read it without re-fetching Garmin.
// ---------------------------------------------------------------------------

const SEGMENT_CODE: Record<SegmentType, string> = {
  'warm-up': 'w',
  'main': 'm',
  'tempo': 't',
  'interval-work': 'iw',
  'interval-rest': 'ir',
  'cool-down': 'c',
};

const SEGMENT_FROM_CODE: Record<string, SegmentType> = Object.fromEntries(
  Object.entries(SEGMENT_CODE).map(([k, v]) => [v, k as SegmentType]),
);

/** One-line session type classification from segment composition. */
export function summarizeSegments(splits: SplitData[]): string {
  if (splits.length === 0) return '';

  const work = splits.filter((s) => s.segmentType === 'interval-work');
  const rest = splits.filter((s) => s.segmentType === 'interval-rest');
  const tempo = splits.filter((s) => s.segmentType === 'tempo');
  const main = splits.filter((s) => s.segmentType === 'main');

  if (work.length >= 2) {
    const avgWorkMin = Math.round(
      work.reduce((s, w) => s + w.durationSeconds, 0) / work.length / 60,
    );
    const avgRestMin = rest.length > 0
      ? Math.round(rest.reduce((s, r) => s + r.durationSeconds, 0) / rest.length / 60)
      : null;
    const avgWorkHr = (() => {
      const hrs = work.map((w) => w.avgHr).filter((h): h is number => h != null);
      return hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
    })();
    const hrPart = avgWorkHr ? ` @ ${avgWorkHr} HR` : '';
    const restPart = avgRestMin ? `, ~${avgRestMin}min recovery` : '';
    return `VO2 max intervals: ${work.length}×${avgWorkMin}min${hrPart}${restPart}`;
  }

  if (tempo.length >= 1) {
    const tempoMin = Math.round(tempo.reduce((s, t) => s + t.durationSeconds, 0) / 60);
    const baseMin = Math.round(main.reduce((s, m) => s + m.durationSeconds, 0) / 60);
    return baseMin > 0
      ? `Z2 base ${baseMin}min + ${tempoMin}min tempo finish`
      : `Tempo session: ${tempoMin}min`;
  }

  const mainMin = Math.round(main.reduce((s, m) => s + m.durationSeconds, 0) / 60);
  return mainMin > 0 ? `Z2 base ~${mainMin}min` : '';
}

export interface LapData {
  i: number;
  t: SegmentType;
  d: number;
  du: number;
  hr: number | null;
  p: number | null;
  c: number | null;
}

/** Parse the compact JSON back into typed laps. Returns [] on any error. */
export function parseLapsFromProperty(json: string | null | undefined): LapData[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as Array<{ i: number; t: string; d: number; du: number; hr: number | null; p: number | null; c?: number | null }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        i: x.i,
        t: SEGMENT_FROM_CODE[x.t] ?? 'main',
        d: x.d,
        du: x.du,
        hr: x.hr,
        p: x.p,
        c: x.c ?? null,
      }))
      .filter((x): x is LapData => Number.isFinite(x.i) && Number.isFinite(x.d) && Number.isFinite(x.du));
  } catch {
    return [];
  }
}

/** Parse Garmin lapDTOs into SplitData[] (raw lap distances, "M:SS" pace, all per-lap form
 *  metrics). Does NOT classify segments — callers run classifyLaps() if they want segment types. */
export function parseLapDTOs(laps: Record<string, unknown>[]): SplitData[] {
  const splits: SplitData[] = [];
  for (let i = 0; i < laps.length; i++) {
    const lap = laps[i];
    const distM = (lap.distance as number) ?? (lap.distanceInMeters as number) ?? 0;
    const durS = (lap.duration as number) ?? (lap.elapsedDuration as number) ?? 0;
    const avgSpeed = (lap.averageSpeed as number) ?? 0;
    const avgRunCadence = (lap.averageRunCadence as number) ?? null;
    const strideLen = (lap.strideLength as number) ?? null;

    splits.push({
      lapIndex: i + 1,
      distanceMeters: distM,
      durationSeconds: durS,
      pacePerKm: avgSpeed > 0 ? speedToPace(avgSpeed) : '--:--',
      avgHr: (lap.averageHR as number) ?? null,
      maxHr: (lap.maxHR as number) ?? null,
      cadence: avgRunCadence ? Math.round(avgRunCadence) : null,
      strideCm: strideLen ? Math.round(strideLen * 10) / 10 : null,
      gctMs: (lap.groundContactTime as number) != null ? Math.round(lap.groundContactTime as number) : null,
      powerW: (lap.averagePower as number) ?? null,
      vertOscCm: (lap.verticalOscillation as number) != null
        ? Math.round((lap.verticalOscillation as number) * 10) / 10
        : null,
      vertRatioPct: (lap.verticalRatio as number) != null
        ? Math.round((lap.verticalRatio as number) * 10) / 10
        : null,
      elevGain: (lap.elevationGain as number) ?? null,
      elevLoss: (lap.elevationLoss as number) ?? null,
      segmentType: 'main',
    });
  }
  return splits;
}

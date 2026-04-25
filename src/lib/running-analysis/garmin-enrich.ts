/**
 * Garmin API enrichment for running activities.
 * Fetches splits, weather, and performance details for a given activity ID.
 */

import { createGarminClient } from '@/lib/sync/garmin';

const API_BASE = 'https://connectapi.garmin.com';
const CALL_DELAY_MS = 1500;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type SegmentType =
  | 'warm-up'
  | 'main'
  | 'tempo'
  | 'interval-work'
  | 'interval-rest'
  | 'cool-down';

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

export interface WeatherData {
  tempC: number | null;
  feelsLikeC: number | null;
  humidity: number | null;
  description: string | null;
}

export interface EnrichedActivityData {
  splits: SplitData[];
  weather: WeatherData;
  perfCondition: number | null;
  decouplingPct: number | null;
}

function fToC(f: number | null): number | null {
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
function findDescriptorIndex(
  descriptors: Record<string, unknown>[],
  keyName: string
): number {
  const idx = descriptors.findIndex(
    (d) => (d.key as string) === keyName || (d.metricsKey as string) === keyName
  );
  return idx;
}

function calcDecoupling(
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

function extractPerfCondition(
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

export async function enrichActivity(activityId: string): Promise<EnrichedActivityData> {
  const client = await createGarminClient();

  // Make calls sequentially with delays to avoid rate limiting
  let splitsResult: unknown = null;
  let weatherResult: unknown = null;
  let detailsResult: unknown = null;

  try {
    splitsResult = await client.get(`${API_BASE}/activity-service/activity/${activityId}/splits`);
    console.log(`[garmin-enrich] Splits fetched for ${activityId}`);
  } catch (err) {
    console.error(`[garmin-enrich] Splits fetch failed for ${activityId}:`, err instanceof Error ? err.message : err);
  }

  await delay(CALL_DELAY_MS);

  try {
    weatherResult = await client.get(`${API_BASE}/activity-service/activity/${activityId}/weather`);
    console.log(`[garmin-enrich] Weather fetched for ${activityId}`);
  } catch (err) {
    console.error(`[garmin-enrich] Weather fetch failed for ${activityId}:`, err instanceof Error ? err.message : err);
  }

  await delay(CALL_DELAY_MS);

  try {
    detailsResult = await client.get(`${API_BASE}/activity-service/activity/${activityId}/details?maxChartSize=2000&maxPolylineSize=100`);
    console.log(`[garmin-enrich] Details fetched for ${activityId}`);
  } catch (err) {
    console.error(`[garmin-enrich] Details fetch failed for ${activityId}:`, err instanceof Error ? err.message : err);
  }

  // Parse splits
  const splits: SplitData[] = [];
  if (splitsResult) {
    const splitsData = splitsResult as { lapDTOs?: Record<string, unknown>[] };
    const laps = splitsData?.lapDTOs ?? [];
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
    classifyLaps(splits);
  }

  // Parse weather — Garmin uses field names `temp` and `apparentTemp`
  const weather: WeatherData = { tempC: null, feelsLikeC: null, humidity: null, description: null };
  if (weatherResult) {
    const w = weatherResult as Record<string, unknown>;
    const rawTemp = (w.temp as number) ?? (w.temperature as number) ?? null;
    const rawApparentTemp = (w.apparentTemp as number) ?? (w.apparentTemperature as number) ?? null;
    weather.tempC = fToC(rawTemp);
    weather.feelsLikeC = fToC(rawApparentTemp);
    weather.humidity = (w.relativeHumidity as number) ?? null;
    const weatherType = w.weatherTypeDTO as { desc?: string } | undefined;
    weather.description = weatherType?.desc ?? null;
  }

  // Parse details — performance condition and decoupling
  let perfCondition: number | null = null;
  let decouplingPct: number | null = null;
  if (detailsResult) {
    const details = detailsResult as {
      metricDescriptors?: Record<string, unknown>[];
      activityDetailMetrics?: { metrics: number[] }[];
    };
    const descriptors = details?.metricDescriptors ?? [];
    const metrics = details?.activityDetailMetrics ?? [];
    if (descriptors.length > 0 && metrics.length > 0) {
      // Log available keys for diagnostics
      const availableKeys = descriptors.map((d) => (d.key as string) || (d.metricsKey as string) || 'unknown');
      console.log(`[garmin-enrich] Available metric keys for ${activityId}: ${availableKeys.join(', ')}`);
      perfCondition = extractPerfCondition(descriptors, metrics);
      decouplingPct = calcDecoupling(descriptors, metrics);
      console.log(`[garmin-enrich] PerfCondition=${perfCondition}, Decoupling=${decouplingPct} for ${activityId}`);
    } else {
      console.warn(`[garmin-enrich] Details response missing descriptors (${descriptors.length}) or metrics (${metrics.length}) for ${activityId}`);
    }
  }

  return { splits, weather, perfCondition, decouplingPct };
}

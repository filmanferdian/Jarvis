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
  const dataPoints = activityDetailMetrics
    .map((m) => ({
      ts: m.metrics[tsIdx],
      hr: m.metrics[hrIdx],
    }))
    .filter((p) => p.hr != null && p.hr > 0 && p.ts != null);

  if (dataPoints.length < 10) {
    console.warn(`[garmin-enrich] Decoupling: only ${dataPoints.length} valid data points`);
    return null;
  }

  // Calculate total duration and 80% cutoff by timestamp
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
      });
    }
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

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

function calcDecoupling(
  metricDescriptors: { metricsKey: string; number: number }[],
  activityDetailMetrics: { metrics: number[] }[]
): number | null {
  const hrIdx = metricDescriptors.findIndex((d) => d.metricsKey === 'directHeartRate');
  const paceIdx = metricDescriptors.findIndex((d) => d.metricsKey === 'directSpeed');
  if (hrIdx === -1 || paceIdx === -1 || activityDetailMetrics.length < 4) return null;

  const dataPoints = activityDetailMetrics
    .map((m) => ({
      hr: m.metrics[hrIdx],
      pace: m.metrics[paceIdx],
    }))
    .filter((p) => p.hr > 0 && p.pace > 0);

  if (dataPoints.length < 10) return null;

  // Take first 80% of activity duration, split that in half
  const cutoff = Math.floor(dataPoints.length * 0.8);
  const first = dataPoints.slice(0, Math.floor(cutoff / 2));
  const second = dataPoints.slice(Math.floor(cutoff / 2), cutoff);

  if (first.length === 0 || second.length === 0) return null;

  const avgHrFirst = first.reduce((s, p) => s + p.hr, 0) / first.length;
  const avgHrSecond = second.reduce((s, p) => s + p.hr, 0) / second.length;

  if (avgHrFirst === 0) return null;

  // Decoupling = HR drift as percentage
  const decoupling = ((avgHrSecond - avgHrFirst) / avgHrFirst) * 100;

  return Math.round(decoupling * 10) / 10;
}

function extractPerfCondition(
  metricDescriptors: { metricsKey: string; number: number }[],
  activityDetailMetrics: { metrics: number[] }[]
): number | null {
  const idx = metricDescriptors.findIndex((d) => d.metricsKey === 'directPerformanceCondition');
  if (idx === -1) return null;

  // Find last non-null, non-zero value
  for (let i = activityDetailMetrics.length - 1; i >= 0; i--) {
    const val = activityDetailMetrics[i].metrics[idx];
    if (val !== null && val !== undefined && val !== 0) {
      return val;
    }
  }
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
        gctMs: (lap.groundContactTime as number) ?? null,
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
      metricDescriptors?: { metricsKey: string; number: number }[];
      activityDetailMetrics?: { metrics: number[] }[];
    };
    const descriptors = details?.metricDescriptors ?? [];
    const metrics = details?.activityDetailMetrics ?? [];
    if (descriptors.length > 0 && metrics.length > 0) {
      perfCondition = extractPerfCondition(descriptors, metrics);
      decouplingPct = calcDecoupling(descriptors, metrics);
      console.log(`[garmin-enrich] PerfCondition=${perfCondition}, Decoupling=${decouplingPct} for ${activityId}`);
    } else {
      console.warn(`[garmin-enrich] Details response missing descriptors/metrics for ${activityId}`);
    }
  }

  return { splits, weather, perfCondition, decouplingPct };
}

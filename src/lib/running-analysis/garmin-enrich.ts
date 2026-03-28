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

function secondsToPace(seconds: number, distanceM: number): string {
  if (!distanceM || !seconds) return '--:--';
  const paceSecPerKm = (seconds / distanceM) * 1000;
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

  // Split at 80% mark (first 80% = aerobic, last 20% = late)
  const cutoff = Math.floor(dataPoints.length * 0.8);
  const first = dataPoints.slice(0, Math.floor(cutoff / 2));
  const second = dataPoints.slice(Math.floor(cutoff / 2), cutoff);

  if (first.length === 0 || second.length === 0) return null;

  const avgHrFirst = first.reduce((s, p) => s + p.hr, 0) / first.length;
  const avgHrSecond = second.reduce((s, p) => s + p.hr, 0) / second.length;
  const avgPaceFirst = first.reduce((s, p) => s + p.pace, 0) / first.length;
  const avgPaceSecond = second.reduce((s, p) => s + p.pace, 0) / second.length;

  if (avgPaceFirst === 0 || avgHrFirst === 0) return null;

  // Decoupling = (HR/pace ratio drift) as percentage
  const ratioFirst = avgHrFirst / avgPaceFirst;
  const ratioSecond = avgHrSecond / avgPaceSecond;
  const decoupling = ((ratioSecond - ratioFirst) / ratioFirst) * 100;

  return Math.round(decoupling * 10) / 10;
}

function extractPerfCondition(
  metricDescriptors: { metricsKey: string; number: number }[],
  activityDetailMetrics: { metrics: number[] }[]
): number | null {
  const idx = metricDescriptors.findIndex((d) => d.metricsKey === 'directPerformanceCondition');
  if (idx === -1) return null;

  // Find last non-zero value
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

  const results = await Promise.allSettled([
    (async () => {
      const data = await client.get(`${API_BASE}/activity-service/activity/${activityId}/splits`);
      await delay(CALL_DELAY_MS);
      return data;
    })(),
    (async () => {
      await delay(CALL_DELAY_MS);
      const data = await client.get(`${API_BASE}/activity-service/activity/${activityId}/weather`);
      await delay(CALL_DELAY_MS);
      return data;
    })(),
    (async () => {
      await delay(CALL_DELAY_MS * 2);
      return client.get(`${API_BASE}/activity-service/activity/${activityId}/details?maxChartSize=2000&maxPolylineSize=100`);
    })(),
  ]);

  // Parse splits
  const splits: SplitData[] = [];
  if (results[0].status === 'fulfilled') {
    const splitsData = results[0].value as { lapDTOs?: Record<string, unknown>[] };
    const laps = splitsData?.lapDTOs ?? [];
    laps.forEach((lap, i) => {
      const distM = (lap.distanceInMeters as number) ?? 0;
      const durS = (lap.elapsedDuration as number) ?? 0;
      splits.push({
        lapIndex: i + 1,
        distanceMeters: distM,
        durationSeconds: durS,
        pacePerKm: secondsToPace(durS, distM),
        avgHr: (lap.averageHR as number) ?? null,
        maxHr: (lap.maxHR as number) ?? null,
      });
    });
  }

  // Parse weather
  const weather: WeatherData = { tempC: null, feelsLikeC: null, humidity: null, description: null };
  if (results[1].status === 'fulfilled') {
    const w = results[1].value as {
      temperature?: number;
      apparentTemperature?: number;
      relativeHumidity?: number;
      weatherTypeDTO?: { desc?: string };
    };
    weather.tempC = fToC(w?.temperature ?? null);
    weather.feelsLikeC = fToC(w?.apparentTemperature ?? null);
    weather.humidity = w?.relativeHumidity ?? null;
    weather.description = w?.weatherTypeDTO?.desc ?? null;
  }

  // Parse details
  let perfCondition: number | null = null;
  let decouplingPct: number | null = null;
  if (results[2].status === 'fulfilled') {
    const details = results[2].value as {
      metricDescriptors?: { metricsKey: string; number: number }[];
      activityDetailMetrics?: { metrics: number[] }[];
    };
    const descriptors = details?.metricDescriptors ?? [];
    const metrics = details?.activityDetailMetrics ?? [];
    perfCondition = extractPerfCondition(descriptors, metrics);
    decouplingPct = calcDecoupling(descriptors, metrics);
  }

  return { splits, weather, perfCondition, decouplingPct };
}

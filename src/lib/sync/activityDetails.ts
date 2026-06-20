/**
 * Builds and persists `garmin_activity_details` rows for the Charge (FP) iOS app.
 *
 * The Charge app reads Supabase directly with the publishable key and cannot decrypt
 * garmin_activities.raw_json. The activity SUMMARY (already pulled at sync time, plaintext)
 * gives us the tiles + Garmin time-in-zone with zero extra calls. Per-km splits and the
 * per-second HR sample stream are NOT in that summary — they live behind two extra Garmin
 * endpoints, which we fetch here using the live session passed in by the caller.
 *
 * Units contract: meters / seconds / sec-per-km / bpm / spm / meters.
 */

import { GarminConnect } from 'garmin-connect';
import { supabase } from '@/lib/supabase';

const API_BASE = 'https://connectapi.garmin.com';
const SPLIT_DETAIL_DELAY_MS = 1500; // between /splits and /details, matches garmin-enrich.ts
const MAX_HR_SAMPLES = 2000;

export interface ActivitySplit {
  km: number;
  distance_m: number;
  duration_s: number;
  pace_sec_per_km: number | null;
  avg_hr: number | null;
  avg_cadence: number | null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function roundOrNull(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

function paceFrom(distanceM: number, durationS: number): number | null {
  if (!(distanceM > 0) || !(durationS > 0)) return null;
  return Math.round(durationS / (distanceM / 1000));
}

/** Find a metric column index in the /details descriptors, checking both `key` and `metricsKey`. */
function descriptorIndex(descriptors: Record<string, unknown>[], keyName: string): number {
  return descriptors.findIndex(
    (d) => (d.key as string) === keyName || (d.metricsKey as string) === keyName,
  );
}

/**
 * Build per-km splits from Garmin lapDTOs.
 *
 * Outdoor runs: laps are taken as-is (the watch auto-laps each km).
 * Treadmill runs: GPS is unreliable and the user laps each km manually, so we impose the
 * km structure — first N-1 splits are exactly 1.0 km, the last split carries the remainder
 * (total - (N-1) km), and every pace is recomputed off the corrected distances.
 */
function buildSplits(
  laps: Record<string, unknown>[],
  isTreadmill: boolean,
  totalDistanceM: number | null,
): ActivitySplit[] {
  const n = laps.length;
  if (n === 0) return [];

  // Treadmill correction only applies when we have a trustworthy total and it can hold the
  // imposed (N-1) full kilometers; otherwise fall back to raw lap distances.
  const canCorrect =
    isTreadmill && totalDistanceM != null && totalDistanceM > (n - 1) * 1000;
  if (isTreadmill && !canCorrect) {
    console.warn(
      `[activity-details] treadmill correction skipped (total=${totalDistanceM}, laps=${n}); using raw lap distances`,
    );
  }

  return laps.map((lap, i) => {
    const rawDist = num(lap.distance) ?? 0;
    const durationS = Math.round(num(lap.duration) ?? num(lap.elapsedDuration) ?? 0);

    let distanceM: number;
    if (canCorrect) {
      distanceM = i < n - 1 ? 1000 : (totalDistanceM as number) - (n - 1) * 1000;
    } else {
      distanceM = rawDist;
    }
    distanceM = Math.round(distanceM);

    return {
      km: i + 1,
      distance_m: distanceM,
      duration_s: durationS,
      pace_sec_per_km: paceFrom(distanceM, durationS),
      avg_hr: roundOrNull(lap.averageHR),
      avg_cadence: roundOrNull(lap.averageRunCadence),
    };
  });
}

/** Extract a downsampled bpm int array from a /details response. */
function buildHrSamples(details: {
  metricDescriptors?: Record<string, unknown>[];
  activityDetailMetrics?: { metrics: number[] }[];
}): number[] | null {
  const descriptors = details.metricDescriptors ?? [];
  const metrics = details.activityDetailMetrics ?? [];
  if (descriptors.length === 0 || metrics.length === 0) return null;

  const hrIdx = descriptorIndex(descriptors, 'directHeartRate');
  if (hrIdx === -1) {
    console.warn('[activity-details] /details has no directHeartRate column');
    return null;
  }

  const samples: number[] = [];
  for (const row of metrics) {
    const v = row.metrics?.[hrIdx];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) samples.push(Math.round(v));
  }
  if (samples.length === 0) return null;

  // Garmin already caps at maxChartSize; defensively downsample if longer.
  if (samples.length > MAX_HR_SAMPLES) {
    const stride = Math.ceil(samples.length / MAX_HR_SAMPLES);
    return samples.filter((_, i) => i % stride === 0);
  }
  return samples;
}

function buildHrZoneSeconds(act: Record<string, unknown>): Record<string, number> | null {
  const zones: Record<string, number> = {};
  let any = false;
  for (let z = 1; z <= 5; z++) {
    const v = num(act[`hrTimeInZone_${z}`]);
    if (v != null) any = true;
    zones[`z${z}`] = v != null ? Math.round(v) : 0;
  }
  return any ? zones : null;
}

/**
 * Fetch /splits + /details for one run and upsert its garmin_activity_details row.
 *
 * Always persists the zero-call summary fields (tiles + hr_zone_seconds) plus whatever splits /
 * hr_samples the fetches returned, so a single failed endpoint still yields a useful row.
 * Re-throws the underlying fetch error afterward so the caller (syncGarmin) can detect a Garmin
 * rate-limit and trip the circuit breaker.
 *
 * @param client live GarminConnect session (reused — no re-login)
 * @param act    the raw activity summary already pulled by the caller (plaintext)
 */
export async function buildAndUpsertActivityDetails(
  client: GarminConnect,
  act: Record<string, unknown>,
): Promise<void> {
  const activityId = String(act.activityId);
  const isTreadmill = (act.activityType as Record<string, unknown>)?.typeKey === 'treadmill_running';
  const totalDistanceM = num(act.distance);

  let fetchErr: unknown = null;
  let splitsResult: unknown = null;
  let detailsResult: unknown = null;

  try {
    splitsResult = await client.get(`${API_BASE}/activity-service/activity/${activityId}/splits`);
  } catch (err) {
    fetchErr ??= err;
    console.error(`[activity-details] /splits failed for ${activityId}:`, err instanceof Error ? err.message : err);
  }

  await new Promise((r) => setTimeout(r, SPLIT_DETAIL_DELAY_MS));

  try {
    detailsResult = await client.get(
      `${API_BASE}/activity-service/activity/${activityId}/details?maxChartSize=${MAX_HR_SAMPLES}`,
    );
  } catch (err) {
    fetchErr ??= err;
    console.error(`[activity-details] /details failed for ${activityId}:`, err instanceof Error ? err.message : err);
  }

  const laps = (splitsResult as { lapDTOs?: Record<string, unknown>[] })?.lapDTOs ?? [];
  const splits = laps.length > 0 ? buildSplits(laps, isTreadmill, totalDistanceM) : null;
  const hrSamples = detailsResult
    ? buildHrSamples(detailsResult as Parameters<typeof buildHrSamples>[0])
    : null;

  const record = {
    activity_id: activityId,
    total_distance_m: totalDistanceM,
    avg_cadence: roundOrNull(act.averageRunningCadenceInStepsPerMinute),
    max_hr: roundOrNull(act.maxHR),
    elevation_gain_m: num(act.elevationGain),
    splits,
    hr_samples: hrSamples,
    hr_zone_seconds: buildHrZoneSeconds(act),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('garmin_activity_details')
    .upsert(record, { onConflict: 'activity_id' });
  if (error) {
    console.warn(`[activity-details] upsert failed for ${activityId}: ${error.message}`);
  }

  // Surface the fetch error so the caller can trip the circuit breaker on a rate-limit.
  if (fetchErr) throw fetchErr;
}

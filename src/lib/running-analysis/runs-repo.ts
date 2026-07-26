/**
 * Run reader for the weekly analysis and the cardio-analysis page.
 *
 * Replaces the old Notion Runs DB round-trip (query pages -> read page properties -> summary).
 * Everything now comes from two Supabase tables:
 *   - `garmin_activities`        one row per activity, plus the encrypted Garmin summary in raw_json
 *   - `garmin_activity_details`  per-lap data, weather, decoupling and the richer coaching metrics
 *
 * The details row may be absent (it is written by a rate-limited enrichment pass that can lag),
 * so every field that also exists on the activity summary falls back to raw_json rather than
 * going null. Without that, a run enriched late would lose cadence / load / VO2 in the prompt.
 */

import { supabase } from '@/lib/supabase';
import { unwrapJsonb } from '@/lib/crypto';
import type { WeeklyRunSummary } from './analysis-engine';
import { isSegmentType, type LapData } from './garmin-enrich';

const WIB_OFFSET = 7 * 60 * 60 * 1000;

/** Garmin activity types that count as running. */
export function isRun(activityType: string | null | undefined): boolean {
  if (!activityType) return false;
  const t = activityType.toLowerCase();
  return t === 'running' || t === 'treadmill_running' || t === 'trail_running' || t === 'track_running';
}

interface ActivityRow {
  activity_id: string;
  activity_type: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  avg_hr: number | null;
  started_at: string;
  raw_json: unknown;
}

interface DetailsRow {
  activity_id: string;
  total_distance_m: number | null;
  avg_cadence: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  decoupling_pct: number | null;
  perf_condition: number | null;
  temp_c: number | null;
  humidity_pct: number | null;
  weather_desc: string | null;
  vo2_max: number | null;
  training_effect: string | null;
  training_load: number | null;
  avg_power_w: number | null;
  session_profile: string | null;
  lap_detail: unknown;
}

/**
 * Real run vs incline walk. A slow average can mean either a walk or a VO2 session whose
 * interval rests drag the mean above 10:00/km, so HR is the tiebreaker: real running keeps
 * avg HR >= 130, sustained walking stays below.
 * (Apr 21 VO2: 11:33/km @ 143 HR, kept. Apr 22 walk: 13:01/km @ 120 HR, dropped.)
 */
function isRealRun(a: ActivityRow): boolean {
  if (!isRun(a.activity_type)) return false;
  if (!a.duration_seconds || !a.distance_meters) return true;
  const secPerKm = (a.duration_seconds / a.distance_meters) * 1000;
  if (secPerKm <= 600) return true;
  if (a.avg_hr != null && a.avg_hr >= 130) return true;
  return false;
}

function formatDuration(totalSeconds: number | null): string {
  if (!totalSeconds || totalSeconds <= 0) return '';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Bare "M:SS" per km, computed from distance and duration.
 *
 * Deliberately not `garmin_activities.avg_pace`: that column stores "8:50 /km", and every
 * consumer that splits it on ':' parses the seconds as NaN.
 */
function formatPace(distanceMeters: number | null, durationSeconds: number | null): string {
  if (!distanceMeters || !durationSeconds || distanceMeters <= 0) return '';
  const secPerKm = durationSeconds / (distanceMeters / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** garmin_activity_details.lap_detail -> the compact LapData the prompt renders. */
function mapLapDetail(lapDetail: unknown): LapData[] {
  if (!Array.isArray(lapDetail)) return [];
  return lapDetail
    .map((raw) => {
      const l = raw as Record<string, unknown>;
      return {
        i: Number(l.index),
        t: isSegmentType(l.segment) ? l.segment : ('main' as const),
        d: Math.round(Number(l.distance_m)),
        du: Math.round(Number(l.duration_s)),
        hr: (l.avg_hr as number | null) ?? null,
        p: (l.pace_sec_per_km as number | null) ?? null,
        c: (l.cadence as number | null) ?? null,
      };
    })
    .filter((l) => Number.isFinite(l.i) && Number.isFinite(l.d) && Number.isFinite(l.du));
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Presentation rounding. Both Garmin's raw summary and some stored columns carry full float
 * precision (training_load 36.94035339355469, elevation_gain_m 26.599994659423828). The old
 * Notion ingest rounded on the way in, so the UI and the prompt never saw this; now that this
 * module is the read boundary, it rounds here instead. Same precision as that ingest used.
 */
function r0(v: number | null | undefined): number | null {
  return v == null ? null : Math.round(v);
}
function r1(v: number | null | undefined): number | null {
  return v == null ? null : Math.round(v * 10) / 10;
}

function toSummary(a: ActivityRow, d: DetailsRow | undefined): WeeklyRunSummary {
  const raw = unwrapJsonb<Record<string, unknown>>(a.raw_json) ?? {};
  const distanceM = d?.total_distance_m ?? a.distance_meters;

  return {
    activityId: a.activity_id,
    date: new Date(new Date(a.started_at).getTime() + WIB_OFFSET).toISOString().split('T')[0],
    name: (raw.activityName as string) || 'Jakarta Running',
    distanceKm: distanceM ? Math.round((distanceM / 1000) * 100) / 100 : 0,
    durationFormatted: formatDuration(a.duration_seconds),
    durationMins: a.duration_seconds ? Math.round(a.duration_seconds / 60) : 0,
    avgPacePerKm: formatPace(distanceM, a.duration_seconds),
    avgHr: r0(a.avg_hr),
    maxHr: r0(d?.max_hr ?? num(raw.maxHR)),
    trainingLoad: r1(d?.training_load ?? num(raw.activityTrainingLoad)),
    trainingEffect: d?.training_effect ?? null,
    vo2Max: r0(d?.vo2_max ?? num(raw.vO2MaxValue)),
    perfCondition: r0(d?.perf_condition),          // activity stream only
    decouplingPct: r1(d?.decoupling_pct),          // activity stream only
    tempC: r1(d?.temp_c),
    humidityPct: r0(d?.humidity_pct),
    weather: d?.weather_desc ?? null,
    cadenceSpm: r0(d?.avg_cadence ?? num(raw.averageRunningCadenceInStepsPerMinute)),
    avgPowerW: r0(d?.avg_power_w ?? num(raw.avgPower)),
    elevGainM: r1(d?.elevation_gain_m ?? num(raw.elevationGain)),
    sessionProfile: d?.session_profile ?? null,
    laps: mapLapDetail(d?.lap_detail),
  };
}

/**
 * All real runs between two WIB dates (inclusive), oldest first.
 * Replaces notion-runs-db.getRunsForPeriod + analysis-engine.extractRunSummaries.
 */
export async function getRunsForPeriod(startDate: string, endDate: string): Promise<WeeklyRunSummary[]> {
  const { data: activities, error } = await supabase
    .from('garmin_activities')
    .select('activity_id, activity_type, distance_meters, duration_seconds, avg_hr, started_at, raw_json')
    .gte('started_at', `${startDate}T00:00:00+07:00`)
    .lte('started_at', `${endDate}T23:59:59+07:00`)
    .order('started_at', { ascending: true });

  if (error) throw new Error(`garmin_activities query failed: ${error.message}`);

  const runs = ((activities ?? []) as ActivityRow[]).filter(isRealRun);
  if (runs.length === 0) return [];

  const { data: details } = await supabase
    .from('garmin_activity_details')
    .select(
      'activity_id, total_distance_m, avg_cadence, max_hr, elevation_gain_m, decoupling_pct, ' +
        'perf_condition, temp_c, humidity_pct, weather_desc, vo2_max, training_effect, ' +
        'training_load, avg_power_w, session_profile, lap_detail',
    )
    .in('activity_id', runs.map((r) => r.activity_id));

  const byId = new Map(((details ?? []) as unknown as DetailsRow[]).map((d) => [d.activity_id, d]));
  return runs.map((a) => toSummary(a, byId.get(a.activity_id)));
}

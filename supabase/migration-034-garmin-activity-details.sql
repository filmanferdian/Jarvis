-- Migration 034: garmin_activity_details
-- Rich per-run fields persisted as PLAINTEXT for the Charge (FP) iOS app, which reads
-- Supabase directly with the publishable key and cannot decrypt garmin_activities.raw_json.
-- One row per running activity, keyed by activity_id (matches garmin_activities.activity_id).
--
-- Units contract (so Charge renders correctly):
--   distances in meters, durations in seconds, pace in seconds-per-km, HR in bpm,
--   cadence in steps-per-minute (spm), elevation in meters.
--
-- Populated forward-only on each Garmin sync (no historical backfill). Splits + hr_samples
-- come from the /activity/{id}/splits and /activity/{id}/details endpoints; the tiles and
-- hr_zone_seconds come from the activity summary already pulled at sync time.

create table if not exists public.garmin_activity_details (
  activity_id      text primary key,   -- matches garmin_activities.activity_id
  total_distance_m numeric,            -- corrected distance (treadmill: watch field; outdoor: GPS)
  avg_cadence      int,                -- spm
  max_hr           int,                -- bpm
  elevation_gain_m numeric,            -- meters (null for treadmill)
  splits           jsonb,              -- [{ km, distance_m, duration_s, pace_sec_per_km, avg_hr, avg_cadence }]
  hr_samples       jsonb,              -- [int bpm ...] (Garmin-downsampled, <= 2000)
  hr_zone_seconds  jsonb,              -- { z1, z2, z3, z4, z5 } seconds, Garmin's own zones
  updated_at       timestamptz default now()
);

-- RLS: read-only for the Charge app (anon/authenticated), mirroring the read policies already
-- added to garmin_activities / garmin_daily / fitness_context. Writes stay service-role only
-- (service role bypasses RLS, so no write policy is needed).
alter table public.garmin_activity_details enable row level security;

create policy "fp read garmin_activity_details"
  on public.garmin_activity_details
  for select
  to anon, authenticated
  using (true);

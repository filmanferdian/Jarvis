-- Migration 035: running insights for the Charge (FP) app
--
-- (1) Extend garmin_activity_details with richer per-run coaching metrics (all nullable,
--     populated forward-only during the Garmin sync; same forward-only pattern as 034).
--     `lap_detail` holds rich classified per-lap form data for the coach prompt; the Charge-facing
--     `splits` column is unchanged.
-- (2) New running_insights table caches the Claude-written per-run coaching insight, pulled
--     incrementally by Charge via updated_at. Read-only RLS for the app; writes service-role only.
--
-- Units: pace sec/km, HR bpm, cadence spm, distance m, GCT ms, power W, temp °C, ratio %.

alter table public.garmin_activity_details
  add column if not exists decoupling_pct  numeric,
  add column if not exists perf_condition  int,
  add column if not exists feels_like_c     numeric,
  add column if not exists temp_c           numeric,
  add column if not exists humidity_pct     int,
  add column if not exists weather_desc     text,
  add column if not exists gct_ms           int,
  add column if not exists vertical_ratio   numeric,
  add column if not exists vo2_max          numeric,
  add column if not exists training_effect  text,
  add column if not exists training_load    numeric,
  add column if not exists avg_power_w      int,
  add column if not exists lap_detail       jsonb;

create table if not exists public.running_insights (
  activity_id   text primary key,        -- matches garmin_activities.activity_id
  insight       text,                    -- Claude-generated markdown
  model         text,
  generated_at  timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.running_insights enable row level security;

create policy "fp read running_insights"
  on public.running_insights
  for select
  to anon, authenticated
  using (true);

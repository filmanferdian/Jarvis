-- Migration 038: Notion exit, running slice.
--
-- (1) session_profile on garmin_activity_details. Last run field that lived only in Notion
--     ("Z2 base 45min + 10min tempo finish"). Records planned session intent, which Garmin
--     does not supply; derived from segment composition by summarizeSegments().
-- (2) fitness_protocols: prose the coach prompt needs, previously sliced live out of the
--     Notion Transformation program page by plan-loader.ts.
-- (3) Retro-codify three schema changes applied out of band so a replay from files matches prod.
-- (4) Drop the sync_status row that cached the Weekly Insights Notion DB id.
--
-- Units unchanged from 034/035: pace sec/km, HR bpm, cadence spm, distance m, GCT ms,
-- power W, temp °C, ratio %, stride cm, vertical oscillation cm.

-- (1) + (3) stride_cm / vertical_oscillation_cm were applied out of band on 2026-07-26.
alter table public.garmin_activity_details
  add column if not exists stride_cm               numeric,
  add column if not exists vertical_oscillation_cm numeric,
  add column if not exists session_profile         text;

-- (3) running_weekly_insights was applied out of band on 2026-07-26 and holds the 23 rows
--     migrated from the Notion Weekly Insights DB. Codified here, unchanged.
create table if not exists public.running_weekly_insights (
  week_start          date primary key,
  week_end            date not null,
  runs_logged         int,
  total_distance_km   numeric,
  total_time_min      numeric,
  total_training_load numeric,
  avg_hr              int,
  avg_cadence_spm     int,
  avg_pace            text,
  how_was_this_week   text,
  whats_good          text,
  what_needs_work     text,
  focus_next_week     text,
  model               text,
  generated_at        timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.running_weekly_insights enable row level security;

drop policy if exists "fp read running_weekly_insights" on public.running_weekly_insights;
create policy "fp read running_weekly_insights"
  on public.running_weekly_insights
  for select
  to anon, authenticated
  using (true);

-- (2) Hand-edited fitness prose, keyed so nutrition/lifting protocols can land here later
--     without another migration. Mirrors the notion_context(page_key, content) shape.
--
--     RLS on with NO policy on purpose: service-role only. This content is injected verbatim
--     into a Claude prompt and the Charge app has no use for it, so it stays off the anon
--     read path that the other fitness tables carry.
--
--     Deliberately NOT a column on fitness_context: syncFitness() does delete-then-insert on
--     that table every day, so any column it does not write is wiped within 24h.
create table if not exists public.fitness_protocols (
  protocol_key text primary key,          -- 'cardio'
  title        text,
  content      text not null,             -- markdown
  source       text,                      -- 'notion:<page_id>' | 'manual'
  updated_at   timestamptz not null default now()
);

alter table public.fitness_protocols enable row level security;

-- (4) weekly-insights-db.ts cached the Notion Weekly Insights DB id in sync_status.last_error
--     under a fake sync_type. That module is deleted; drop the orphan row.
--
--     The id it held, recorded here so the frozen Notion fallback stays reachable:
--       Weekly Insights DB  331c674a-ecec-81c1-91f9-f8dfd6a85c43
--       Runs DB             061105bb-bd86-464b-b344-c86d89c771ca
delete from public.sync_status where sync_type = 'running-weekly-insights-db-id';

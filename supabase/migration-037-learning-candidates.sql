-- Migration 037: Learning candidates (raw weekly capture)
--
-- The staging table between the two halves of the Learnings pipeline:
--   Railway captures raw items here weekly, with no Claude call and therefore
--   no Anthropic API credits. Claude Code later reads this table, ranks and
--   deduplicates against learning_entries, and writes the finished rows.
--
-- Splitting capture from ranking is what makes a missed laptop week harmless:
-- the week's raw material is already banked on schedule, so the ranking step
-- can run whenever the app is next opened.
--
-- One row per (topic, week_start, dedupe_key). Re-running a capture in the same
-- week refreshes the row rather than duplicating it, so a manual re-run is safe.
--
-- star_count exists so GitHub ranking can move from absolute stars (a weak
-- proxy that surfaces permanent giants) to week-over-week velocity: week N
-- compares against the value captured in week N-1.
--
-- RLS enabled, no permissive policy: service-role only (matches 027/029/036).

create table if not exists public.learning_candidates (
  id uuid primary key default gen_random_uuid(),
  topic text not null default 'ai',
  week_start date not null,
  dedupe_key text not null,          -- normalized url
  source text not null,              -- 'GitHub' | 'Hacker News' | 'r/LocalLLaMA' | '@simonw' | ...
  lens_hint text,                    -- fetcher's guess; Claude makes the final call
  title text not null,
  url text,
  signal text,                       -- ranking evidence, e.g. 'HN 1619 pts'
  body text,                         -- short excerpt, capped by the fetcher
  star_count integer,                -- GitHub only; drives velocity ranking
  published date,
  captured_at timestamptz not null default now(),
  unique (topic, week_start, dedupe_key)
);

create index if not exists idx_learning_candidates_week on public.learning_candidates (topic, week_start);
create index if not exists idx_learning_candidates_key on public.learning_candidates (dedupe_key);

-- Per-source health for each capture run, so a silently-empty feed is visible
-- rather than just producing a thinner digest.
create table if not exists public.learning_capture_runs (
  id uuid primary key default gen_random_uuid(),
  topic text not null default 'ai',
  week_start date not null,
  ran_from text not null,            -- 'railway' | 'local'
  sources_ok text[] default '{}',
  sources_failed text[] default '{}',
  item_count integer not null default 0,
  errors text[] default '{}',
  ran_at timestamptz not null default now()
);

create index if not exists idx_learning_capture_runs_week on public.learning_capture_runs (topic, week_start);

alter table public.learning_candidates enable row level security;
alter table public.learning_capture_runs enable row level security;

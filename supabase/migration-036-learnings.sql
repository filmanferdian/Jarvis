-- Migration 036: Learnings (weekly external-signal review)
--
-- Backs the /learnings page. One topic per tab ('ai' is the first); within a
-- topic, items are grouped into lenses. Written by the weekly Claude Code
-- scheduled task, NOT by Jarvis: Jarvis only reads these tables, so no
-- Anthropic API credits are spent on this feature.
--
-- (1) learning_entries is the permanent ledger. One row per distinct item ever
--     seen, keyed by (topic, dedupe_key). A repeat sighting bumps weeks_running
--     and last_seen_week instead of inserting a duplicate, which is what stops
--     the same trending repo resurfacing as "new" every week.
-- (2) learning_runs holds the per-(topic, week, lens) narrative summary plus
--     source health, so the page can show which feeds succeeded that week.
--
-- RLS enabled, no permissive policy: only the server-side service-role key can
-- read/write (matches migration-027 and migration-029).

create table if not exists public.learning_entries (
  id uuid primary key default gen_random_uuid(),
  topic text not null default 'ai',        -- page tab: ai | (future topics)
  lens text not null,                      -- github | tooling | industry
  dedupe_key text not null,                -- normalized url, or source|slug when no url
  title text not null,
  url text,
  source text,                             -- 'GitHub' | 'Hacker News' | 'r/LocalLLaMA' | '@simonw' | ...
  signal text,                             -- ranking evidence, e.g. 'HN 1619 pts' / '+4.2k stars'
  why_it_matters text,
  rank integer not null default 0,         -- within (topic, week_start, lens); lower sorts first
  week_start date not null,                -- WIB week this item was surfaced in
  first_seen_week date not null,
  last_seen_week date not null,
  weeks_running integer not null default 1,
  status text not null default 'new',      -- new | adopted | dismissed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic, dedupe_key)
);

create index if not exists idx_learning_entries_week on public.learning_entries (topic, week_start);
create index if not exists idx_learning_entries_last_seen on public.learning_entries (last_seen_week);

create table if not exists public.learning_runs (
  id uuid primary key default gen_random_uuid(),
  topic text not null default 'ai',
  week_start date not null,
  lens text not null,
  summary text,                            -- short "what changed this week" narrative
  item_count integer not null default 0,
  new_count integer not null default 0,
  sources_ok text[] default '{}',
  sources_failed text[] default '{}',
  generated_at timestamptz not null default now(),
  unique (topic, week_start, lens)
);

create index if not exists idx_learning_runs_week on public.learning_runs (topic, week_start);

alter table public.learning_entries enable row level security;
alter table public.learning_runs enable row level security;

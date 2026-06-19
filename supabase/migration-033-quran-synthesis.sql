-- Migration 033: Quran daily reading synthesis cache
-- POST /api/quran/synthesis generates the daily Sunni-tafsir reading synthesis
-- for the Ubayy reader on demand and caches it one row per (user, date) so the
-- briefing and the 15:30 callback reuse the same text instead of regenerating.
-- RLS enabled, no permissive policy: only the server-side service-role key can
-- read/write (matches the migration-030 posture).
--
-- Idempotent backfill: the table was created directly in production before this
-- file existed, so every statement guards with IF NOT EXISTS. Safe to re-run.

CREATE TABLE IF NOT EXISTS quran_synthesis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'filman',
  date date NOT NULL,
  surah integer,
  range text,
  synthesis text NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE quran_synthesis ENABLE ROW LEVEL SECURITY;

-- Migration 014: Briefing deltas table
-- Store multiple delta updates per day, each with optional audio.
-- Cleaned up when next morning briefing is generated.

CREATE TABLE IF NOT EXISTS briefing_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  delta_text TEXT NOT NULL,
  audio_url TEXT,
  has_changes BOOLEAN DEFAULT true,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_deltas_date ON briefing_deltas(date);

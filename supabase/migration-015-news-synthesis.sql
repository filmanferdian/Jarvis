-- Migration 015: News synthesis table
-- Stores 3 briefings per day (7am, 1pm, 7pm WIB time slots)
-- Sprint 11: Current Events Synthesis feature

CREATE TABLE IF NOT EXISTS news_synthesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
  synthesis_text TEXT NOT NULL,
  voiceover_text TEXT,
  email_count INTEGER DEFAULT 0,
  sources_used TEXT[] DEFAULT '{}',
  since_timestamp TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_news_synthesis_date ON news_synthesis(date);

ALTER TABLE news_synthesis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON news_synthesis FOR ALL USING (true);

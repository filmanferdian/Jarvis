-- Jarvis Sprint 1: Full schema migration
-- Run this in Supabase SQL editor

-- Domains
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  alert_threshold_days INTEGER NOT NULL DEFAULT 14,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the 10 domains
INSERT INTO domains (name, display_order, alert_threshold_days) VALUES
  ('Work', 1, 7),
  ('Wealth', 2, 14),
  ('Side projects', 3, 14),
  ('Health', 4, 7),
  ('Fitness', 5, 5),
  ('Spiritual', 6, 7),
  ('Family', 7, 7),
  ('Learning', 8, 14),
  ('Networking', 9, 14),
  ('Personal branding', 10, 14);

-- Domain KPIs
CREATE TABLE domain_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id),
  kpi_name TEXT NOT NULL,
  kpi_value NUMERIC,
  kpi_target NUMERIC,
  kpi_unit TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  trend TEXT CHECK (trend IN ('up', 'down', 'flat'))
);

-- Top KPIs (surfaced on dashboard)
CREATE TABLE top_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_kpi_id UUID NOT NULL REFERENCES domain_kpis(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  added_date DATE NOT NULL DEFAULT CURRENT_DATE,
  review_date DATE
);

-- Briefing cache
CREATE TABLE briefing_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  briefing_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_sources_used JSONB
);

-- Voice log
CREATE TABLE voice_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  transcript TEXT,
  intent TEXT,
  action_taken TEXT,
  response_text TEXT
);

-- Calendar events cache
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  is_all_day BOOLEAN DEFAULT false,
  source TEXT NOT NULL DEFAULT 'unknown',
  last_synced TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ClickUp tasks cache
CREATE TABLE clickup_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT UNIQUE,
  name TEXT NOT NULL,
  due_date DATE,
  priority INTEGER,
  status TEXT,
  list_name TEXT,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email synthesis cache (bridge from e-Assistant)
CREATE TABLE email_synthesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  synthesis_text TEXT NOT NULL,
  important_count INTEGER DEFAULT 0,
  deadline_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate limit tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date)
);

-- Enable Row Level Security on all tables
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE top_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE clickup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_synthesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow all operations (single-user app, service role bypasses anyway)
CREATE POLICY "Allow all for authenticated" ON domains FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON domain_kpis FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON top_kpis FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON briefing_cache FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON voice_log FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON clickup_tasks FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON email_synthesis FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON api_usage FOR ALL USING (true);

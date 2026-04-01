-- Migration 018: Enable RLS on tables missing it
-- Defense-in-depth: app uses service_role key which bypasses RLS,
-- but RLS should be enabled on all tables to prevent accidental
-- exposure via the anon key.

-- Tables from existing migrations that were missing RLS:
ALTER TABLE notion_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON notion_context
  FOR ALL USING (true);

ALTER TABLE briefing_deltas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON briefing_deltas
  FOR ALL USING (true);

ALTER TABLE email_triage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON email_triage
  FOR ALL USING (true);

-- Table created manually in Supabase (no prior migration):
ALTER TABLE program_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON program_schedule
  FOR ALL USING (true);

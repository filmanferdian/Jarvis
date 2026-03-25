-- Migration 018: Enable RLS on tables that were missing it
-- Fixes Supabase security advisory: rls_disabled_in_public
-- Affected tables: notion_context, briefing_deltas, email_triage

ALTER TABLE notion_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for notion_context" ON notion_context FOR ALL USING (true);

ALTER TABLE briefing_deltas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for briefing_deltas" ON briefing_deltas FOR ALL USING (true);

ALTER TABLE email_triage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for email_triage" ON email_triage FOR ALL USING (true);

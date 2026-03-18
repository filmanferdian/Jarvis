-- Tracks when each sync type last ran (for debouncing dashboard-load syncs)
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL UNIQUE,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_result TEXT,       -- 'success' or 'error'
  last_error TEXT,
  events_synced INTEGER DEFAULT 0
);

INSERT INTO sync_status (sync_type) VALUES
  ('google-calendar'),
  ('outlook-calendar'),
  ('notion-tasks'),
  ('morning-briefing'),
  ('email-synthesis');

ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON sync_status FOR ALL USING (true);

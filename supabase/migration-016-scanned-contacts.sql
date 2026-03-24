-- Migration 016: Scanned contacts from calendar invites
-- Stores external contacts extracted from Google Calendar & Outlook events

CREATE TABLE IF NOT EXISTS scanned_contacts (
  email TEXT PRIMARY KEY,
  name TEXT,
  company TEXT,
  first_seen_date DATE NOT NULL,
  last_seen_date DATE NOT NULL,
  event_count INTEGER DEFAULT 1,
  sources TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'existing', 'synced')),
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scanned_contacts_status
  ON scanned_contacts(status);
CREATE INDEX IF NOT EXISTS idx_scanned_contacts_last_seen
  ON scanned_contacts(last_seen_date DESC);

ALTER TABLE scanned_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON scanned_contacts
  FOR ALL USING (true);

-- Register in sync_status
INSERT INTO sync_status (sync_type) VALUES ('contact-scan')
  ON CONFLICT (sync_type) DO NOTHING;

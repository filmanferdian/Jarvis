-- Migration 017: Email triage and auto-draft tracking

CREATE TABLE email_triage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  thread_id TEXT,
  source TEXT NOT NULL,              -- 'gmail:filman@group.infinid.id' or 'outlook'
  from_address TEXT NOT NULL,
  from_name TEXT,
  subject TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  body_snippet TEXT,                 -- first 500 chars
  category TEXT NOT NULL CHECK (category IN (
    'need_response', 'informational', 'newsletter', 'notification', 'automated'
  )),
  category_reason TEXT,
  draft_created BOOLEAN DEFAULT false,
  draft_id TEXT,
  draft_snippet TEXT,
  triage_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, source)
);

CREATE INDEX idx_email_triage_date ON email_triage(triage_date DESC);
CREATE INDEX idx_email_triage_category ON email_triage(category);

INSERT INTO sync_status (sync_type) VALUES ('email-triage')
  ON CONFLICT (sync_type) DO NOTHING;

ALTER TABLE email_triage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for email_triage" ON email_triage FOR ALL USING (true);

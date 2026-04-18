-- Migration 021: Email draft blocklist
-- Senders whose emails are still triaged/classified but for which Jarvis skips
-- generating a draft reply (e.g. Kantorku HRIS action-button emails).

CREATE TABLE email_draft_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL UNIQUE,       -- case-insensitive substring match on from_address
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_triage ADD COLUMN draft_skipped_reason TEXT;

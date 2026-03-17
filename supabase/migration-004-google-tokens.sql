-- Migration 004: Google OAuth token storage (multi-account)
-- Run this in Supabase SQL editor after applying migration-003.

CREATE TABLE google_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON google_tokens FOR ALL USING (true);

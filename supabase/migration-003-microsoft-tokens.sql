-- Migration 003: Microsoft OAuth token storage
-- Run this in Supabase SQL editor after applying migration-002.

CREATE TABLE microsoft_tokens (
  id TEXT PRIMARY KEY DEFAULT 'default',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE microsoft_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON microsoft_tokens FOR ALL USING (true);

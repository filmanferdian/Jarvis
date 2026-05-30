-- Migration 030: Investment quotes cache
-- Prices for the /investments watchlist are refreshed by a cron job a few times
-- a day (around each exchange's mid-day and close), not pulled live on page load.
-- One row per ticker; the page reads the last stored value. RLS enabled, no
-- permissive policy: only the server-side service-role key can read/write
-- (matches migration-027 posture).

CREATE TABLE IF NOT EXISTS investment_quotes (
  ticker text PRIMARY KEY,
  symbol text NOT NULL,
  price numeric,
  currency text,
  change_pct numeric,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE investment_quotes ENABLE ROW LEVEL SECURITY;

-- Migration 031: Multi-period price changes for investment quotes
-- Adds 7-day and 30-day percentage changes alongside the existing 1-day change,
-- so the /investments page can show last price vs the previous day, 7 days ago,
-- and 30 days ago. Populated by the same few-times-a-day cron
-- (syncInvestmentQuotes). For US + IDX these come from extra columns in the
-- Google Sheet (GOOGLEFINANCE history); SGX has no history feed so they stay
-- null there. Nullable so a transient upstream miss leaves the column blank
-- rather than failing the upsert.

ALTER TABLE investment_quotes
  ADD COLUMN IF NOT EXISTS change_pct_7d numeric,
  ADD COLUMN IF NOT EXISTS change_pct_30d numeric;

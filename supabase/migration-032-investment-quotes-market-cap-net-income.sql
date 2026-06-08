-- Migration 032: Market cap and last-FY net income for investment quotes
-- Adds latest market capitalization and last full-year net income alongside the
-- existing price/change columns, so the /investments page can show a market-cap
-- column (and order each industry group by it) plus a net-income column.
-- Populated by the same few-times-a-day cron (syncInvestmentQuotes): market cap
-- comes from GOOGLEFINANCE("...","marketcap") for US + IDX (and a manual sheet
-- value for SGX, whose feed has no fundamentals); net income is a manual last-FY
-- figure in the listing currency. Both nullable so a transient upstream miss
-- leaves the column blank rather than failing the upsert; the cron preserves the
-- prior value across a momentary blank.

ALTER TABLE investment_quotes
  ADD COLUMN IF NOT EXISTS market_cap numeric,
  ADD COLUMN IF NOT EXISTS last_fy_net_income numeric;

// Twice-a-day price refresh for the /investments watchlist.
// A cron job calls syncInvestmentQuotes() around each exchange's mid-day and
// close; the page reads the last stored value via getStoredQuotes(). This keeps
// pulls infrequent (one Yahoo request per symbol, a few times a day) instead of
// hitting the upstream on every page load.

import { supabase } from '@/lib/supabase';
import { flatCompanies } from '@/data/watchlist';
import { fetchQuotes, Quote } from '@/lib/investments/quotes';

export interface QuoteSyncResult {
  fetched: number;
  priced: number;
}

/** Pull fresh quotes for every watchlist company and upsert the priced ones. */
export async function syncInvestmentQuotes(): Promise<QuoteSyncResult> {
  const companies = flatCompanies();
  const bySymbol = await fetchQuotes(companies.map((c) => c.symbol));

  const now = new Date().toISOString();
  const rows = companies.map((c) => {
    const q = bySymbol[c.symbol];
    return {
      ticker: c.ticker,
      symbol: c.symbol,
      price: q?.price ?? null,
      currency: q?.currency ?? null,
      change_pct: q?.changePct ?? null,
      fetched_at: now,
    };
  });

  // Only overwrite a stored quote when we actually got a price, so a transient
  // upstream failure (rate-limit, timeout) never blanks out the last good value.
  const priced = rows.filter((r) => r.price !== null);
  if (priced.length > 0) {
    const { error } = await supabase
      .from('investment_quotes')
      .upsert(priced, { onConflict: 'ticker' });
    if (error) throw new Error(`investment_quotes upsert: ${error.message}`);
  }

  return { fetched: rows.length, priced: priced.length };
}

export interface StoredQuotesResult {
  quotes: Record<string, Quote>;
  asOf: string | null;
}

/** Last stored quote per ticker, plus the most recent refresh time. */
export async function getStoredQuotes(): Promise<StoredQuotesResult> {
  const { data, error } = await supabase
    .from('investment_quotes')
    .select('ticker, symbol, price, currency, change_pct, fetched_at');
  if (error) throw new Error(`investment_quotes read: ${error.message}`);

  const quotes: Record<string, Quote> = {};
  let asOf: string | null = null;
  for (const row of data ?? []) {
    quotes[row.ticker] = {
      symbol: row.symbol,
      price: row.price,
      currency: row.currency,
      changePct: row.change_pct,
    };
    if (!asOf || row.fetched_at > asOf) asOf = row.fetched_at;
  }
  return { quotes, asOf };
}

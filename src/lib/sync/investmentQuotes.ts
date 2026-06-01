// A few-times-a-day price refresh for the /investments watchlist.
// A cron job calls syncInvestmentQuotes() around each exchange's mid-day and
// close; the page reads the last stored value via getStoredQuotes(). This keeps
// pulls infrequent and lets the page render instantly from stored values.
//
// Sources (Yahoo is blocked from datacenter IPs, so it is no longer used):
//   - US + IDX: a Google Sheet of GOOGLEFINANCE formulas, published as CSV.
//   - SGX: SGX's own public delayed-price JSON feed.
// Each source degrades to empty on failure; we only overwrite a stored quote
// when a price actually came back, so a transient outage never blanks good data.

import { supabase } from '@/lib/supabase';
import { flatCompanies, FlatCompany } from '@/data/watchlist';
import type { Quote } from '@/lib/investments/quotes';
import { fetchSheetQuotes } from '@/lib/investments/sheetQuotes';
import { fetchSgxQuotes } from '@/lib/investments/sgxQuotes';

export interface QuoteSyncResult {
  fetched: number;
  priced: number;
}

function currencyForExchange(exchange: string): string {
  if (exchange === 'IDX') return 'IDR';
  if (exchange === 'SGX') return 'SGD';
  return 'USD';
}

/** SGX counter code for a company (e.g. D05 from the D05.SI Yahoo symbol). */
function sgxCode(c: FlatCompany): string {
  return (c.yahoo ?? c.ticker).replace(/\.SI$/i, '').toUpperCase();
}

/** Pull fresh quotes for every watchlist company and upsert the priced ones. */
export async function syncInvestmentQuotes(): Promise<QuoteSyncResult> {
  const companies = flatCompanies();
  const sgxCodes = companies.filter((c) => c.exchange === 'SGX').map(sgxCode);

  const [sheet, sgx] = await Promise.all([fetchSheetQuotes(), fetchSgxQuotes(sgxCodes)]);

  const now = new Date().toISOString();
  const rows = companies.map((c) => {
    const q = c.exchange === 'SGX' ? sgx[sgxCode(c)] : sheet[c.ticker.toUpperCase()];
    const price = q?.price ?? null;
    return {
      ticker: c.ticker,
      symbol: c.symbol,
      price,
      currency: price !== null ? currencyForExchange(c.exchange) : null,
      change_pct: q?.changePct ?? null,
      fetched_at: now,
    };
  });

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

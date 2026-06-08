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
// The 7d/30d history columns are additionally preserved across a fetch that
// returns null for them, because those GOOGLEFINANCE history columns briefly
// blank out while recalculating.

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

interface PriorValues {
  change_pct_7d: number | null;
  change_pct_30d: number | null;
  market_cap: number | null;
  last_fy_net_income: number | null;
}

/** Prior stored 7d/30d, market cap, and net income per ticker, used to preserve
 *  them when a fetch returns null (the GOOGLEFINANCE history and marketcap columns
 *  blank out during recalculation; net income is manual and rarely blanks). */
async function fetchPriorValues(): Promise<Record<string, PriorValues>> {
  const out: Record<string, PriorValues> = {};
  const { data, error } = await supabase
    .from('investment_quotes')
    .select('ticker, change_pct_7d, change_pct_30d, market_cap, last_fy_net_income');
  if (error || !data) return out;
  for (const row of data) {
    out[row.ticker] = {
      change_pct_7d: row.change_pct_7d,
      change_pct_30d: row.change_pct_30d,
      market_cap: row.market_cap,
      last_fy_net_income: row.last_fy_net_income,
    };
  }
  return out;
}

/** Pull fresh quotes for every watchlist company and upsert the priced ones. */
export async function syncInvestmentQuotes(): Promise<QuoteSyncResult> {
  const companies = flatCompanies();
  const sgxCodes = companies.filter((c) => c.exchange === 'SGX').map(sgxCode);

  const [sheet, sgx, prior] = await Promise.all([
    fetchSheetQuotes(),
    fetchSgxQuotes(sgxCodes),
    fetchPriorValues(),
  ]);

  const now = new Date().toISOString();
  const rows = companies.map((c) => {
    const sheetRow = sheet[c.ticker.toUpperCase()];
    // SGX price and day change come from the live SGX feed; the feed carries no
    // fundamentals, so SGX market cap and net income come from manual rows in the
    // sheet (same ticker). US/IDX take everything from the sheet.
    const q = c.exchange === 'SGX' ? sgx[sgxCode(c)] : sheetRow;
    const price = q?.price ?? null;
    const prev = prior[c.ticker];
    return {
      ticker: c.ticker,
      symbol: c.symbol,
      price,
      currency: price !== null ? currencyForExchange(c.exchange) : null,
      change_pct: q?.changePct ?? null,
      // Preserve prior non-null 7d/30d: these GOOGLEFINANCE history columns blank
      // out briefly during recalculation, and overwriting the whole row would
      // otherwise wipe good values on a single mistimed fetch. Live price and the
      // 1-day change never blank, so they always take the fresh value.
      change_pct_7d: q?.changePct7d ?? prev?.change_pct_7d ?? null,
      change_pct_30d: q?.changePct30d ?? prev?.change_pct_30d ?? null,
      // Market cap (GOOGLEFINANCE for US/IDX, manual for SGX) and the manual last-FY
      // net income both come from the sheet; preserve prior values so a momentary
      // blank marketcap recalc cannot wipe the column.
      market_cap: sheetRow?.marketCap ?? prev?.market_cap ?? null,
      last_fy_net_income: sheetRow?.netIncome ?? prev?.last_fy_net_income ?? null,
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
    .select(
      'ticker, symbol, price, currency, change_pct, change_pct_7d, change_pct_30d, market_cap, last_fy_net_income, fetched_at',
    );
  if (error) throw new Error(`investment_quotes read: ${error.message}`);

  const quotes: Record<string, Quote> = {};
  let asOf: string | null = null;
  for (const row of data ?? []) {
    quotes[row.ticker] = {
      symbol: row.symbol,
      price: row.price,
      currency: row.currency,
      changePct: row.change_pct,
      changePct7d: row.change_pct_7d,
      changePct30d: row.change_pct_30d,
      marketCap: row.market_cap,
      netIncome: row.last_fy_net_income,
    };
    if (!asOf || row.fetched_at > asOf) asOf = row.fetched_at;
  }
  return { quotes, asOf };
}

// Live price quotes from Yahoo Finance's public chart endpoint.
// One request per symbol (the batch /quote endpoint now needs a crumb/cookie),
// run in parallel with a per-request timeout and a short in-memory cache so a
// page load doesn't re-hit Yahoo for every navigation.

const CHART_API = 'https://query1.finance.yahoo.com/v8/finance/chart';
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

// A browser-like UA; Yahoo rejects requests without one.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface Quote {
  symbol: string;
  price: number | null;
  currency: string | null;
  changePct: number | null;
  changePct7d: number | null;
  changePct30d: number | null;
  /** Latest market capitalization in the listing currency; null when unavailable. */
  marketCap: number | null;
  /** Last full-year net income in the listing currency; null when unavailable. */
  netIncome: number | null;
}

const cache = new Map<string, { ts: number; quote: Quote }>();

async function fetchOne(symbol: string): Promise<Quote> {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.quote;

  const empty: Quote = {
    symbol,
    price: null,
    currency: null,
    changePct: null,
    changePct7d: null,
    changePct30d: null,
    marketCap: null,
    netIncome: null,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${CHART_API}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return empty;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return empty;

    const price: number = meta.regularMarketPrice;
    const prev =
      typeof meta.chartPreviousClose === 'number'
        ? meta.chartPreviousClose
        : typeof meta.previousClose === 'number'
          ? meta.previousClose
          : null;
    const quote: Quote = {
      symbol,
      price,
      currency: typeof meta.currency === 'string' ? meta.currency : null,
      changePct: prev && prev !== 0 ? (price - prev) / prev : null,
      changePct7d: null,
      changePct30d: null,
      marketCap: null,
      netIncome: null,
    };
    cache.set(symbol, { ts: Date.now(), quote });
    return quote;
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch quotes for a set of Yahoo symbols, keyed by symbol. Never throws. */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = [...new Set(symbols)];
  const results = await Promise.all(unique.map(fetchOne));
  const out: Record<string, Quote> = {};
  for (const q of results) out[q.symbol] = q;
  return out;
}

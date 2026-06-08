// Singapore Exchange quotes from SGX's own public delayed-price feed.
// SGX revoked GOOGLEFINANCE access and Yahoo blocks datacenter IPs, but the JSON
// endpoint that powers sgx.com is reachable server-side and returns the whole
// board in one call. We fetch it and pick out the counter codes we track.
//
// The `params` list is validated server-side as a set: a single unknown token
// rejects the whole request, so only known-good tokens are included here.

const SGX_URL =
  'https://api.sgx.com/securities/v1.1?excludetypes=bonds' +
  '&params=nc%2Cn%2Clt%2Cchange_vs_pc_percentage&pagestart=0&pagesize=1500';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT_MS = 8_000;

export interface SourceQuote {
  price: number | null;
  /** Day change as a fraction (0.0125 = +1.25%), matching the stored convention. */
  changePct: number | null;
  /** 7-day change as a fraction; null when the source has no history (e.g. SGX). */
  changePct7d: number | null;
  /** 30-day change as a fraction; null when the source has no history. */
  changePct30d: number | null;
  /** Latest market capitalization in the listing currency; null when unavailable. */
  marketCap: number | null;
  /** Last full-year net income in the listing currency; null when unavailable. */
  netIncome: number | null;
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v);
  return NaN;
}

/** Last price + day change for the given SGX counter codes (e.g. D05, O39, U11). */
export async function fetchSgxQuotes(codes: string[]): Promise<Record<string, SourceQuote>> {
  const out: Record<string, SourceQuote> = {};
  const want = new Set(codes.map((c) => c.toUpperCase()));
  if (want.size === 0) return out;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SGX_URL, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return out;
    const data = await res.json();
    const prices = data?.data?.prices;
    if (!Array.isArray(prices)) return out;

    for (const row of prices) {
      const code = typeof row?.nc === 'string' ? row.nc.toUpperCase() : null;
      if (!code || !want.has(code)) continue;
      const lt = toNum(row.lt);
      const price = Number.isFinite(lt) && lt > 0 ? lt : null;
      const cp = toNum(row.change_vs_pc_percentage);
      const changePct = Number.isFinite(cp) ? cp / 100 : null;
      // SGX's feed carries no fundamentals; market cap and net income for the
      // SGX names come from manual rows in the quotes sheet (merged in the sync).
      out[code] = { price, changePct, changePct7d: null, changePct30d: null, marketCap: null, netIncome: null };
    }
    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
  }
}

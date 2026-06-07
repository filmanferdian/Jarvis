// US + IDX quotes from a Google Sheet published as CSV.
// GOOGLEFINANCE covers US and IDX cleanly but only runs inside Google Sheets, so
// a sheet does the per-symbol fan-out and we read one published CSV server-side.
// SGX is handled separately (SGX revoked GOOGLEFINANCE); see sgxQuotes.ts.
//
// Expected CSV shape, one row per company (a header row is tolerated):
//   ticker, price, changePct, changePct7d, changePct30d
// where ticker matches our watchlist ticker and each change is already a fraction
// (the sheet divides GOOGLEFINANCE "changepct" by 100). The 7d/30d columns are
// optional: missing cells parse to null and the page renders a dash.

import type { SourceQuote } from '@/lib/investments/sgxQuotes';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT_MS = 8_000;

// Published-to-web CSV of the "Jarvis Investment Quotes" Google Sheet (US + IDX
// GOOGLEFINANCE formulas). Public, non-secret (tickers and prices only). Override
// with INVESTMENTS_SHEET_CSV_URL if the sheet is ever republished.
const DEFAULT_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLdHlVR3Xz6YlUD5wLtlyTzwI4EmzgBReH8YS3aH0rp_Uy3kNrO-RkXAwYdLYdg6LN76cQ0oEh2Udf/pub?output=csv';

function parseNum(cell: string | undefined): number | null {
  if (cell == null) return null;
  const t = cell.trim().replace(/^"|"$/g, '').replace(/,/g, '');
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** Quotes keyed by uppercased ticker, read from the published-CSV Google Sheet. */
export async function fetchSheetQuotes(): Promise<Record<string, SourceQuote>> {
  const out: Record<string, SourceQuote> = {};
  const url = process.env.INVESTMENTS_SHEET_CSV_URL || DEFAULT_CSV_URL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/csv' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return out;
    const text = await res.text();

    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = line.split(',');
      const ticker = (cells[0] ?? '').trim().replace(/^"|"$/g, '').toUpperCase();
      if (!ticker || ticker === 'TICKER') continue; // skip header
      out[ticker] = {
        price: parseNum(cells[1]),
        changePct: parseNum(cells[2]),
        changePct7d: parseNum(cells[3]),
        changePct30d: parseNum(cells[4]),
      };
    }
    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
  }
}

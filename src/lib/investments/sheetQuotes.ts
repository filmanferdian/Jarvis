// US + IDX quotes from a Google Sheet published as CSV.
// GOOGLEFINANCE covers US and IDX cleanly but only runs inside Google Sheets, so
// a sheet does the per-symbol fan-out and we read one published CSV server-side.
// SGX is handled separately (SGX revoked GOOGLEFINANCE); see sgxQuotes.ts.
//
// Expected CSV shape, one row per company (a header row is tolerated):
//   ticker, price, changePct, changePct7d, changePct30d, marketCap, netIncome
// where ticker matches our watchlist ticker. Each change is a fraction; parseNum
// also accepts a percent string ("-6.45%") in case the sheet cell is percent-
// formatted, so a formatting change can't skew values 100x. The 7d/30d columns
// are optional: missing cells parse to null and the page renders a dash.
// marketCap comes from GOOGLEFINANCE("...","marketcap") (US + IDX); netIncome is a
// manual last-full-year figure in the listing currency (negative for loss-makers).
// Both are optional and parse to null when blank.

import type { SourceQuote } from '@/lib/investments/sgxQuotes';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT_MS = 8_000;

// Published-to-web CSV of the "Jarvis Investment Quotes" Google Sheet (US + IDX
// GOOGLEFINANCE formulas). Public, non-secret (tickers and prices only). Override
// with INVESTMENTS_SHEET_CSV_URL if the sheet is ever republished.
const DEFAULT_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLdHlVR3Xz6YlUD5wLtlyTzwI4EmzgBReH8YS3aH0rp_Uy3kNrO-RkXAwYdLYdg6LN76cQ0oEh2Udf/pub?output=csv';

// Split one CSV line into fields, honoring double-quoted fields that themselves
// contain commas (e.g. a price formatted as "5,075.00"). A naive split(',')
// would tear such a field in two and shift every later column.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseNum(cell: string | undefined): number | null {
  if (cell == null) return null;
  let t = cell.trim().replace(/^"|"$/g, '').replace(/,/g, '');
  if (!t) return null;
  // The sheet may render the change columns as a percent ("-6.45%") or as a raw
  // fraction ("-0.0645") depending on the cell number format. Normalize both to a
  // fraction so a formatting change in the sheet can never skew the values 100x.
  const isPct = t.endsWith('%');
  if (isPct) t = t.slice(0, -1);
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return isPct ? n / 100 : n;
}

/** Quotes keyed by uppercased ticker, read from the published-CSV Google Sheet. */
export async function fetchSheetQuotes(): Promise<Record<string, SourceQuote>> {
  const out: Record<string, SourceQuote> = {};
  const base = process.env.INVESTMENTS_SHEET_CSV_URL || DEFAULT_CSV_URL;
  // Cache-bust: Google serves the published CSV with a 5-minute edge cache
  // (cache-control max-age=300), so a stale snapshot — e.g. one captured while
  // the slower GOOGLEFINANCE history columns were mid-recalc and empty — can be
  // served to the cron even after the sheet has settled. A unique param per call
  // forces an origin read so the 7d/30d columns are not intermittently blank.
  const url = `${base}${base.includes('?') ? '&' : '?'}cb=${Date.now()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/csv' },
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!res.ok) return out;
    const text = await res.text();

    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = splitCsvLine(line);
      const ticker = (cells[0] ?? '').trim().replace(/^"|"$/g, '').toUpperCase();
      if (!ticker || ticker === 'TICKER') continue; // skip header
      out[ticker] = {
        price: parseNum(cells[1]),
        changePct: parseNum(cells[2]),
        changePct7d: parseNum(cells[3]),
        changePct30d: parseNum(cells[4]),
        marketCap: parseNum(cells[5]),
        netIncome: parseNum(cells[6]),
      };
    }
    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
  }
}

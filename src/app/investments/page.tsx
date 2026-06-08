'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { WATCHLIST } from '@/data/watchlist';
import { renderMemo } from '@/lib/investments/renderMemo';

interface MemoProps {
  company: string | null;
  ticker: string;
  market: string | null;
  currency: string | null;
  method: string | null;
  verdict: string | null;
  fairValue: number | null;
  fairValueLow: number | null;
  fairValueHigh: number | null;
  currentPrice: number | null;
  upside: number | null;
  cvShare: number | null;
  wacc: number | null;
  valuationDate: string | null;
}

interface MemoResult {
  hasMemo: boolean;
  markdown: string | null;
  props: MemoProps | null;
}

interface Quote {
  symbol: string;
  price: number | null;
  currency: string | null;
  changePct: number | null;
  changePct7d: number | null;
  changePct30d: number | null;
  marketCap: number | null;
  netIncome: number | null;
}

const EMPTY = '–'; // en-dash placeholder for missing values

function verdictStyle(v: string | null): { bg: string; color: string } {
  switch (v) {
    case 'Undervalued':
      return { bg: 'rgba(52, 199, 130, 0.14)', color: 'var(--color-jarvis-success)' };
    case 'Overvalued':
      return { bg: 'rgba(220, 80, 80, 0.14)', color: 'var(--color-jarvis-danger)' };
    case 'Fairly valued':
      return { bg: 'rgba(230, 170, 60, 0.14)', color: 'var(--color-jarvis-warn)' };
    default:
      return { bg: 'var(--color-jarvis-bg-deep)', color: 'var(--color-jarvis-text-faint)' };
  }
}

function decimals(currency: string | null): number {
  return currency === 'IDR' ? 0 : 2;
}

function fmtNum(currency: string | null, n: number): string {
  const d = decimals(currency);
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtMoney(currency: string | null, n: number | null): string {
  if (n === null || n === undefined) return EMPTY;
  return `${currency ? currency + ' ' : ''}${fmtNum(currency, n)}`;
}

function fmtRange(
  currency: string | null,
  low: number | null,
  high: number | null,
  fair: number | null,
): string {
  const code = currency ? currency + ' ' : '';
  if (low !== null && high !== null) return `${code}${fmtNum(currency, low)} ${EMPTY} ${fmtNum(currency, high)}`;
  if (fair !== null) return `${code}${fmtNum(currency, fair)}`;
  return EMPTY;
}

// Compact money for large figures (market cap, net income): T / B / M suffixes,
// keeping the currency code prefix used elsewhere. 1 decimal under 100, else 0.
// Negative values (loss-makers) keep their sign.
function fmtCompact(currency: string | null, n: number | null): string {
  if (n === null || n === undefined) return EMPTY;
  const code = currency ? currency + ' ' : '';
  const abs = Math.abs(n);
  let scaled = n;
  let suffix = '';
  if (abs >= 1e12) {
    scaled = n / 1e12;
    suffix = ' T';
  } else if (abs >= 1e9) {
    scaled = n / 1e9;
    suffix = ' B';
  } else if (abs >= 1e6) {
    scaled = n / 1e6;
    suffix = ' M';
  }
  const d = Math.abs(scaled) >= 100 ? 0 : 1;
  return `${code}${scaled.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`;
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return EMPTY;
  const sign = n > 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(1)}%`;
}

// Gap from the live last price to fair value: (fair − price) / price.
// Falls back to the stored Notion upside (frozen at valuation time) only when
// there is no live quote, so the figure tracks the current price, not the price
// when the valuation was published.
function gapToFair(
  fairValue: number | null | undefined,
  livePrice: number | null | undefined,
  storedUpside: number | null,
): number | null {
  if (
    fairValue !== null &&
    fairValue !== undefined &&
    livePrice !== null &&
    livePrice !== undefined &&
    livePrice > 0
  ) {
    return (fairValue - livePrice) / livePrice;
  }
  return storedUpside;
}

function fmtAsOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtValDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// One period change: a faint label (1D/7D/30D) and a colored percentage.
function Delta({ label, pct }: { label: string; pct: number | null | undefined }) {
  const has = pct !== null && pct !== undefined;
  const color = !has
    ? 'var(--color-jarvis-text-faint)'
    : pct >= 0
      ? 'var(--color-jarvis-success)'
      : 'var(--color-jarvis-danger)';
  return (
    <span className="whitespace-nowrap">
      <span className="text-jarvis-text-faint">{label} </span>
      <span style={{ color }}>{has ? fmtPct(pct) : EMPTY}</span>
    </span>
  );
}

// Order companies within a group by latest market cap, largest first. Names with
// no market cap (no quote yet, or a source that lacks it) sort to the bottom.
function sortByMarketCap<T extends { ticker: string }>(
  companies: T[],
  quotes: Record<string, Quote>,
): T[] {
  return [...companies].sort((a, b) => {
    const ma = quotes[a.ticker]?.marketCap ?? null;
    const mb = quotes[b.ticker]?.marketCap ?? null;
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return mb - ma;
  });
}

export default function InvestmentsPage() {
  const [valuations, setValuations] = useState<Record<string, MemoProps>>({});
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesAsOf, setQuotesAsOf] = useState<string | null>(null);
  const [quotesLoaded, setQuotesLoaded] = useState(false);
  const [memos, setMemos] = useState<Record<string, MemoResult>>({});
  const [detail, setDetail] = useState<string | null>(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback((refresh = false) => {
    const p1 = fetch(refresh ? '/api/investments?refresh=1' : '/api/investments', {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : { valuations: [] }))
      .then((d) => {
        const map: Record<string, MemoProps> = {};
        for (const p of d.valuations || []) map[p.ticker.toUpperCase()] = p;
        setValuations(map);
      })
      .catch(() => {})
      .finally(() => setLoadingTable(false));

    const p2 = fetch('/api/investments?quotes=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { quotes: {}, asOf: null }))
      .then((d) => {
        setQuotes(d.quotes || {});
        setQuotesAsOf(d.asOf ?? null);
      })
      .catch(() => {})
      .finally(() => setQuotesLoaded(true));

    return Promise.all([p1, p2]);
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setMemos({}); // drop client-side memo cache so details re-fetch fresh
    try {
      await loadData(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const openDetail = useCallback(
    async (ticker: string) => {
      setDetail(ticker);
      if (memos[ticker]) return;
      setLoadingMemo(true);
      try {
        const res = await fetch(`/api/investments?ticker=${encodeURIComponent(ticker)}`, {
          credentials: 'include',
        });
        const data: MemoResult = res.ok
          ? await res.json()
          : { hasMemo: false, markdown: null, props: null };
        setMemos((prev) => ({ ...prev, [ticker]: data }));
      } catch {
        setMemos((prev) => ({ ...prev, [ticker]: { hasMemo: false, markdown: null, props: null } }));
      } finally {
        setLoadingMemo(false);
      }
    },
    [memos],
  );

  if (detail) {
    return (
      <AppShell>
        <MemoView
          ticker={detail}
          quote={quotes[detail]}
          memo={memos[detail]}
          loading={loadingMemo && !memos[detail]}
          onBack={() => setDetail(null)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1
            className="text-[20px] text-jarvis-text-primary"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            Investments
          </h1>
          <p className="text-[12px] text-jarvis-text-faint mt-0.5">
            Last price against our valuation fair-value range. Click a row for the full memo.
            {quotesAsOf && <span className="ml-1">Prices as of {fmtAsOf(quotesAsOf)} WIB.</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Re-pull valuations from Notion"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-[8px] border border-jarvis-border bg-jarvis-bg-card px-2.5 py-1.5 text-[12px] text-jarvis-text-secondary hover:bg-jarvis-bg-deep disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-7">
        {WATCHLIST.map((ex) => (
          <section key={ex.exchange}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[13px] font-semibold text-jarvis-text-secondary uppercase tracking-wide">
                {ex.exchange}
              </span>
              <span className="text-[11px] text-jarvis-text-faint">{ex.label}</span>
            </div>

            <div className="overflow-x-auto rounded-[12px] border border-jarvis-border bg-jarvis-bg-card">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-jarvis-text-faint">
                    <th className="text-left font-medium px-3.5 py-2">Company</th>
                    <th className="text-right font-medium px-3.5 py-2">Market cap</th>
                    <th className="text-right font-medium px-3.5 py-2">Net income · last FY</th>
                    <th className="text-right font-medium px-3.5 py-2">Last price · 1D / 7D / 30D</th>
                    <th className="text-right font-medium px-3.5 py-2">Fair value</th>
                    <th className="text-left font-medium px-3.5 py-2">Verdict</th>
                    <th className="px-3.5 py-2"></th>
                  </tr>
                </thead>
                {ex.industries.map((ind) => (
                  <tbody key={ind.industry}>
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3.5 pt-3 pb-1 text-[10.5px] uppercase tracking-wide text-jarvis-text-faint border-t border-jarvis-border"
                      >
                        {ind.industry}
                      </td>
                    </tr>
                    {sortByMarketCap(ind.companies, quotes).map((c) => {
                      const v = valuations[c.ticker];
                      const q = quotes[c.ticker];
                      const analyzed = Boolean(v);
                      const vs = verdictStyle(v?.verdict ?? null);
                      const liveUpside = v ? gapToFair(v.fairValue, q?.price, v.upside ?? null) : null;
                      return (
                        <tr
                          key={c.ticker}
                          onClick={analyzed ? () => openDetail(c.ticker) : undefined}
                          className={`text-[13px] border-t border-jarvis-border/60 ${
                            analyzed ? 'cursor-pointer hover:bg-jarvis-bg-deep' : ''
                          }`}
                        >
                          <td className="px-3.5 py-2.5">
                            <span className="font-mono font-medium text-jarvis-text-primary">{c.ticker}</span>
                            <span className="text-jarvis-text-faint ml-2">{c.name}</span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono text-jarvis-text-secondary">
                            {!quotesLoaded ? (
                              <span className="text-jarvis-text-faint">…</span>
                            ) : (
                              fmtCompact(q?.currency ?? null, q?.marketCap ?? null)
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono text-jarvis-text-secondary">
                            {!quotesLoaded ? (
                              <span className="text-jarvis-text-faint">…</span>
                            ) : (
                              fmtCompact(q?.currency ?? null, q?.netIncome ?? null)
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono">
                            {!quotesLoaded ? (
                              <span className="text-jarvis-text-faint">…</span>
                            ) : (
                              <>
                                <span className="text-jarvis-text-primary">
                                  {fmtMoney(q?.currency ?? null, q?.price ?? null)}
                                </span>
                                <span className="flex justify-end gap-2.5 text-[10px] mt-0.5">
                                  <Delta label="1D" pct={q?.changePct} />
                                  <Delta label="7D" pct={q?.changePct7d} />
                                  <Delta label="30D" pct={q?.changePct30d} />
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono text-jarvis-text-secondary">
                            {v && v.fairValue !== null && v.fairValue !== undefined ? (
                              <>
                                <span className="text-jarvis-text-primary">
                                  {fmtMoney(v.currency, v.fairValue)}
                                </span>
                                {v.fairValueLow !== null && v.fairValueHigh !== null && (
                                  <span className="block text-[10px] text-jarvis-text-faint">
                                    {fmtNum(v.currency, v.fairValueLow)} {EMPTY}{' '}
                                    {fmtNum(v.currency, v.fairValueHigh)}
                                  </span>
                                )}
                                {v.valuationDate && (
                                  <span className="block text-[10px] text-jarvis-text-faint">
                                    as of {fmtValDate(v.valuationDate)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-jarvis-text-faint">{EMPTY}</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {v?.verdict ? (
                              <span className="inline-flex flex-col gap-0.5">
                                <span
                                  className="px-2 py-0.5 rounded-full text-[11px] font-medium w-fit"
                                  style={{ background: vs.bg, color: vs.color }}
                                >
                                  {v.verdict}
                                </span>
                                {liveUpside !== null && (
                                  <span className="text-[10.5px] text-jarvis-text-faint font-mono">
                                    {fmtPct(liveUpside)} upside
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-jarvis-text-faint">{EMPTY}</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            {analyzed ? (
                              <span className="text-[12px] text-jarvis-cta">Details →</span>
                            ) : (
                              <span className="text-[11px] text-jarvis-text-faint">No analysis</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>
        ))}
      </div>

      {loadingTable && (
        <p className="text-[12px] text-jarvis-text-faint mt-4">Loading valuations…</p>
      )}
    </AppShell>
  );
}

function MemoView({
  ticker,
  quote,
  memo,
  loading,
  onBack,
}: {
  ticker: string;
  quote: Quote | undefined;
  memo: MemoResult | undefined;
  loading: boolean;
  onBack: () => void;
}) {
  const props = memo?.props;
  const v = verdictStyle(props?.verdict ?? null);
  const name = props?.company || ticker;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-jarvis-text-dim hover:text-jarvis-text-primary"
      >
        ← Back to table
      </button>

      {loading ? (
        <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-6 animate-pulse h-64" />
      ) : (
        <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[15px] font-semibold text-jarvis-text-primary">{ticker}</span>
                <h2
                  className="text-[18px] text-jarvis-text-primary"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
                >
                  {name}
                </h2>
              </div>
              {props && (
                <p className="text-[11px] text-jarvis-text-faint mt-0.5">
                  {[props.market, props.method, props.valuationDate ? `as of ${props.valuationDate}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            {props?.verdict && (
              <span
                className="px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap"
                style={{ background: v.bg, color: v.color }}
              >
                {props.verdict}
              </span>
            )}
          </div>

          {props && memo?.hasMemo && (
            <>
              <div className="flex flex-wrap gap-2 mt-4">
                <Metric label="Fair value" value={fmtMoney(props.currency, props.fairValue)} />
                <Metric
                  label="Range"
                  value={fmtRange(props.currency, props.fairValueLow, props.fairValueHigh, props.fairValue)}
                />
                <Metric label="Last price" value={fmtMoney(quote?.currency ?? null, quote?.price ?? null)} />
                <Metric label="Market cap" value={fmtCompact(quote?.currency ?? null, quote?.marketCap ?? null)} />
                <Metric label="Net income (FY)" value={fmtCompact(quote?.currency ?? null, quote?.netIncome ?? null)} />
                <Metric label="Upside" value={fmtPct(gapToFair(props.fairValue, quote?.price, props.upside))} />
                {props.valuationDate && (
                  <Metric label="Valued on" value={fmtValDate(props.valuationDate) ?? props.valuationDate} />
                )}
              </div>
              <div className="flex gap-3 mt-2 text-[11px] font-mono">
                <Delta label="1D" pct={quote?.changePct} />
                <Delta label="7D" pct={quote?.changePct7d} />
                <Delta label="30D" pct={quote?.changePct30d} />
              </div>
            </>
          )}

          {memo?.hasMemo && memo.markdown ? (
            <div
              className="mt-5 border-t border-jarvis-border pt-4"
              dangerouslySetInnerHTML={{ __html: renderMemo(memo.markdown) }}
            />
          ) : (
            <div className="mt-6 rounded-[10px] border border-dashed border-jarvis-border p-8 text-center">
              <p className="text-[13px] text-jarvis-text-dim">No analysis yet for {ticker}.</p>
              <p className="text-[12px] text-jarvis-text-faint mt-1">
                Run a valuation to populate the exec summary here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-jarvis-bg-deep px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-jarvis-text-faint">{label}</p>
      <p className="text-[13px] font-mono font-medium text-jarvis-text-primary">{value}</p>
    </div>
  );
}

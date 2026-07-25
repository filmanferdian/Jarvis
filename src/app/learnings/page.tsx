'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { fetchAuth } from '@/lib/fetchAuth';

interface LearningItem {
  id: string;
  title: string;
  url: string | null;
  source: string | null;
  signal: string | null;
  whyItMatters: string | null;
  rank: number;
  weeksRunning: number;
  status: string;
  firstSeenWeek: string;
}

interface Lens {
  key: string;
  label: string;
  summary: string | null;
  itemCount: number;
  newCount: number;
  items: LearningItem[];
}

interface LearningsData {
  topic: string;
  weeks: string[];
  weekStart: string | null;
  latest: {
    lenses: Lens[];
    totalItems: number;
    sourcesOk: string[];
    sourcesFailed: string[];
    generatedAt: string | null;
  } | null;
  message?: string;
}

// Page tabs. Only AI exists today; the topic column is already in the schema so
// a second tab is a one-line addition here plus rows written by a new task.
const TOPICS: { key: string; label: string }[] = [{ key: 'ai', label: 'AI' }];

function formatWeek(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 7 * 864e5);
  const fmt = (d: Date) =>
    `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;
  return `${fmt(start)} – ${fmt(end)} ${end.getUTCFullYear()}`;
}

export default function LearningsPage() {
  const [topic, setTopic] = useState('ai');
  const [week, setWeek] = useState<string | null>(null);
  const [data, setData] = useState<LearningsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ topic });
      if (week) qs.set('week', week);
      setData(await fetchAuth<LearningsData>(`/api/learnings?${qs}`));
    } catch {
      /* silent, falls through to the empty state */
    } finally {
      setLoading(false);
    }
  }, [topic, week]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = data?.latest;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="text-[22px] text-jarvis-text-primary"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              Learnings
            </h1>
            <p className="text-[12px] text-jarvis-text-dim mt-0.5">
              Weekly scan of what changed outside, filtered for what you could actually use
            </p>
            {data?.weekStart && (
              <p className="text-[11px] font-mono text-jarvis-text-faint mt-0.5">
                Week of {formatWeek(data.weekStart)}
                {latest ? ` · ${latest.totalItems} items` : ''}
              </p>
            )}
          </div>

          {/* Week selector, only once there is history to move between */}
          {(data?.weeks?.length ?? 0) > 1 && (
            <select
              value={data?.weekStart ?? ''}
              onChange={(e) => setWeek(e.target.value)}
              className="text-[12px] rounded-[8px] border border-jarvis-border bg-jarvis-bg-deep text-jarvis-text-dim px-2.5 py-1.5 focus:outline-none"
              aria-label="Week"
            >
              {data!.weeks.map((w) => (
                <option key={w} value={w}>
                  {formatWeek(w)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Topic tabs */}
        <div className="flex gap-1 border-b border-jarvis-border">
          {TOPICS.map((t) => {
            const active = t.key === topic;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTopic(t.key);
                  setWeek(null);
                }}
                className={`px-3.5 py-2 text-[13px] font-medium -mb-px transition-colors ${
                  active
                    ? 'border-b-2 border-jarvis-cta text-jarvis-cta'
                    : 'text-jarvis-text-dim hover:text-jarvis-text-primary'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5 animate-pulse h-32"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !latest && (
          <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-10 text-center">
            <p className="text-[13px] text-jarvis-text-dim">
              {data?.message || 'No learnings recorded yet.'}
            </p>
          </div>
        )}

        {/* Lenses */}
        {!loading &&
          latest?.lenses.map((lens) => (
            <section key={lens.key} className="space-y-3">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h2
                  className="text-[15px] text-jarvis-text-primary"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
                >
                  {lens.label}
                </h2>
                <span className="text-[12px] text-jarvis-text-faint font-mono">{lens.items.length}</span>
              </div>

              {lens.summary && (
                <p className="text-[12.5px] text-jarvis-text-secondary leading-relaxed max-w-[75ch]">
                  {lens.summary}
                </p>
              )}

              <div className="space-y-2.5">
                {lens.items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}

        {/* Source health */}
        {!loading && latest && (latest.sourcesOk.length > 0 || latest.sourcesFailed.length > 0) && (
          <div className="pt-2 border-t border-jarvis-border">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3">
              <span
                className="text-[10px] uppercase text-jarvis-text-faint"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}
              >
                Sources
              </span>
              {latest.sourcesOk.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-[11.5px]">
                  <span
                    className="inline-block w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ background: 'var(--color-jarvis-success)' }}
                  />
                  <span className="text-jarvis-text-dim">{s}</span>
                </span>
              ))}
              {latest.sourcesFailed.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 text-[11.5px]">
                  <span
                    className="inline-block w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ background: 'var(--color-jarvis-danger)' }}
                  />
                  <span className="text-jarvis-text-dim">{s}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ItemRow({ item }: { item: LearningItem }) {
  return (
    <div className="rounded-[12px] border border-jarvis-border bg-jarvis-bg-card p-4 flex gap-3.5">
      <span className="text-[12px] font-mono text-jarvis-text-faint pt-0.5 w-5 shrink-0 text-right">
        {item.rank}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] font-medium text-jarvis-text-primary hover:underline break-words"
            >
              {item.title}
            </a>
          ) : (
            <span className="text-[14px] font-medium text-jarvis-text-primary break-words">
              {item.title}
            </span>
          )}
          {item.weeksRunning > 1 && (
            <span
              className="px-2 py-0.5 rounded-full text-[10.5px] font-medium whitespace-nowrap shrink-0"
              style={{ background: 'rgba(230, 170, 60, 0.14)', color: 'var(--color-jarvis-warn)' }}
            >
              week {item.weeksRunning}
            </span>
          )}
        </div>

        {(item.source || item.signal) && (
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-jarvis-text-faint">
            {item.source && <span>{item.source}</span>}
            {item.source && item.signal && <span aria-hidden="true">·</span>}
            {item.signal && <span>{item.signal}</span>}
          </div>
        )}

        {item.whyItMatters && (
          <p className="text-[12.5px] text-jarvis-text-secondary leading-relaxed">{item.whyItMatters}</p>
        )}
      </div>
    </div>
  );
}

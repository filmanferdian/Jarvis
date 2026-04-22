'use client';

import { useState, useMemo } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import { renderMarkdown } from '@/lib/renderMarkdown';

type TabKey = 'email' | 'indonesia' | 'international';

interface Tab {
  synthesis: string;
  sources: string[];
  count: number;
}

interface Tabs {
  email: Tab;
  indonesia: Tab;
  international: Tab;
}

interface SlotData {
  timeSlot: string;
  generatedAt: string;
  // legacy
  synthesis?: string;
  emailCount?: number;
  sourcesUsed?: string[];
  tabs?: Tabs;
}

interface NewsData {
  date: string;
  latest: SlotData | null;
  previous?: SlotData | null;
  slots: SlotData[];
  message?: string;
}

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

const TAB_LABELS: Record<TabKey, string> = {
  email: 'Email',
  indonesia: 'Indonesia',
  international: 'International',
};

function hasContent(tab: Tab | undefined): boolean {
  return !!tab && (tab.synthesis || '').trim().length > 100;
}

function pickDefaultTab(tabs: Tabs | undefined): TabKey {
  if (!tabs) return 'email';
  if (hasContent(tabs.email)) return 'email';
  if (hasContent(tabs.indonesia)) return 'indonesia';
  if (hasContent(tabs.international)) return 'international';
  return 'email';
}

function normalizeTabs(slot: SlotData): Tabs {
  if (slot.tabs) return slot.tabs;
  // Fallback for legacy rows without new columns.
  return {
    email: { synthesis: slot.synthesis || '', sources: slot.sourcesUsed || [], count: slot.emailCount || 0 },
    indonesia: { synthesis: '', sources: [], count: 0 },
    international: { synthesis: '', sources: [], count: 0 },
  };
}

export default function NewsCard() {
  const { data, loading } = usePolling<NewsData>(
    () => fetchAuth('/api/news'),
    5 * 60 * 1000,
  );

  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);

  const latest = data?.latest ?? null;
  const tabs = useMemo(() => (latest ? normalizeTabs(latest) : null), [latest]);
  const effectiveTab: TabKey = activeTab ?? pickDefaultTab(tabs ?? undefined);

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
        </div>
      </div>
    );
  }

  if (!latest || !tabs) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <h2 className="text-base font-medium text-jarvis-text-muted mb-2">Current Events</h2>
        <p className="text-base text-jarvis-text-dim">
          {data?.message || 'No current events briefing available yet.'}
        </p>
      </div>
    );
  }

  const slotLabel = SLOT_LABELS[latest.timeSlot] || latest.timeSlot;
  const activeContent = tabs[effectiveTab];
  const tabOrder: TabKey[] = ['email', 'indonesia', 'international'];

  const olderSlots = (data?.slots ?? []).filter(
    (s) => s.generatedAt !== latest.generatedAt,
  );

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-medium text-jarvis-text-primary">Current Events</h2>
        <span className="text-sm font-mono text-jarvis-accent">{slotLabel}</span>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <svg
          className={`w-3 h-3 text-jarvis-text-muted transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="text-base text-jarvis-text-secondary">
          {expanded ? 'Hide briefing' : 'Show briefing'}
        </span>
      </button>

      {expanded && (
        <>
          {/* Tab bar */}
          <div className="mt-4 flex items-center gap-1 border-b border-jarvis-border">
            {tabOrder.map((key) => {
              const tab = tabs[key];
              const isActive = effectiveTab === key;
              const disabled = !hasContent(tab);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !disabled && setActiveTab(key)}
                  disabled={disabled}
                  className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                    isActive
                      ? 'border-jarvis-accent text-jarvis-text-primary'
                      : disabled
                        ? 'border-transparent text-jarvis-text-dim cursor-not-allowed'
                        : 'border-transparent text-jarvis-text-muted hover:text-jarvis-text-secondary'
                  }`}
                >
                  {TAB_LABELS[key]}
                  {tab.count > 0 && (
                    <span className="ml-1.5 text-xs font-mono text-jarvis-text-muted">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sources strip */}
          {activeContent.sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeContent.sources.slice(0, 12).map((s) => (
                <span
                  key={s}
                  className="text-xs font-mono text-jarvis-text-muted bg-jarvis-bg-subtle px-2 py-0.5 rounded"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Synthesis body */}
          <div
            className="mt-3 text-base text-jarvis-text-secondary whitespace-pre-line"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(
                activeContent.synthesis || 'No content for this tab in this slot.',
              ),
            }}
          />

          {/* Older slots — show only Email synthesis (legacy view) */}
          {olderSlots.map((slot) => {
            const slotTabs = normalizeTabs(slot);
            const body = slotTabs[effectiveTab]?.synthesis || slotTabs.email.synthesis;
            if (!body || body.length < 100) return null;
            return (
              <details key={slot.timeSlot} className="mt-4 border-t border-jarvis-border pt-3">
                <summary className="text-sm text-jarvis-text-muted cursor-pointer hover:text-jarvis-text-secondary transition-colors">
                  {SLOT_LABELS[slot.timeSlot] || slot.timeSlot} · {TAB_LABELS[effectiveTab]}
                </summary>
                <div
                  className="mt-2 text-base text-jarvis-text-secondary whitespace-pre-line opacity-80"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
                />
              </details>
            );
          })}
        </>
      )}
    </div>
  );
}

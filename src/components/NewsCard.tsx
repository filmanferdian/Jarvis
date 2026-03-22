'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import { renderMarkdown } from '@/lib/renderMarkdown';

interface SlotData {
  timeSlot: string;
  synthesis: string;
  emailCount: number;
  sourcesUsed: string[];
  generatedAt: string;
}

interface PreviousSlot {
  date: string;
  timeSlot: string;
  synthesis: string;
  generatedAt: string;
}

interface NewsData {
  date: string;
  latest: SlotData | null;
  previous?: PreviousSlot | null;
  slots: SlotData[];
  message?: string;
}

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export default function NewsCard() {
  const { data, loading } = usePolling<NewsData>(
    () => fetchAuth('/api/news'),
    5 * 60 * 1000,
  );

  const [expanded, setExpanded] = useState(false);

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

  if (!data?.latest) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <h2 className="text-base font-medium text-jarvis-text-muted mb-2">
          Current Events
        </h2>
        <p className="text-base text-jarvis-text-dim">
          {data?.message || 'No current events briefing available yet.'}
        </p>
      </div>
    );
  }

  const { latest } = data;
  const slotLabel = SLOT_LABELS[latest.timeSlot] || latest.timeSlot;

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-medium text-jarvis-text-primary">
          Current Events
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-jarvis-accent">
            {slotLabel}
          </span>
          {latest.sourcesUsed.length > 0 && (
            <span className="text-sm font-mono text-jarvis-text-muted">
              {latest.sourcesUsed.length} source{latest.sourcesUsed.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
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
          <div
            className="mt-3 text-base text-jarvis-text-secondary whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(latest.synthesis) }}
          />
          {data.previous?.synthesis && (
            <details className="mt-4 border-t border-jarvis-border pt-3">
              <summary className="text-sm text-jarvis-text-muted cursor-pointer hover:text-jarvis-text-secondary transition-colors">
                Previous · {SLOT_LABELS[data.previous.timeSlot] || data.previous.timeSlot} · {new Date(data.previous.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </summary>
              <div
                className="mt-2 text-base text-jarvis-text-secondary whitespace-pre-line opacity-80"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(data.previous.synthesis) }}
              />
            </details>
          )}
        </>
      )}
    </div>
  );
}

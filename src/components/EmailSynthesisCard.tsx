'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import { renderMarkdown } from '@/lib/renderMarkdown';

interface SlotData {
  timeSlot: string;
  label: string;
  synthesis: string;
  importantCount: number | null;
  deadlineCount: number | null;
  createdAt: string;
}

interface EmailSynthesisData {
  date: string;
  synthesis: string | null;
  importantCount?: number | null;
  deadlineCount?: number | null;
  timeSlot?: string;
  createdAt?: string;
  slots: SlotData[];
  message?: string;
}

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export default function EmailSynthesisCard() {
  const { data, loading } = usePolling<EmailSynthesisData>(
    () => fetchAuth('/api/emails'),
    5 * 60 * 1000,
  );

  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
          <div className="h-3 bg-jarvis-border rounded w-5/6" />
          <div className="h-3 bg-jarvis-border rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (!data?.synthesis) {
    return (
      <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5">
        <h2 className="text-[15px] text-jarvis-text-primary mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          Email synthesis
        </h2>
        <p className="text-[13px] text-jarvis-text-dim">
          {data?.message || 'No synthesis available yet. The next cron run will populate this.'}
        </p>
      </div>
    );
  }

  const latestLabel = data.timeSlot ? SLOT_LABELS[data.timeSlot] || data.timeSlot : '';
  const olderSlots = data.slots.filter((s) => s.createdAt !== data.createdAt);

  return (
    <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5 flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[15px] text-jarvis-text-primary" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          Email synthesis
        </h2>
        <div className="flex items-center gap-3 text-[11px] font-mono text-jarvis-text-faint">
          {latestLabel && <span className="text-jarvis-ambient">{latestLabel}</span>}
          {data.importantCount != null && data.importantCount > 0 && (
            <span>{data.importantCount} important</span>
          )}
          {data.deadlineCount != null && data.deadlineCount > 0 && (
            <span>{data.deadlineCount} deadline{data.deadlineCount === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>

      <div
        className="text-[13px] text-jarvis-text-dim leading-relaxed whitespace-pre-line flex-1"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(data.synthesis) }}
      />

      {olderSlots.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[11px] font-mono text-jarvis-text-faint hover:text-jarvis-text-dim transition-colors self-start"
        >
          {expanded ? 'Hide earlier slots' : `Show ${olderSlots.length} earlier slot${olderSlots.length === 1 ? '' : 's'}`}
        </button>
      )}

      {expanded && olderSlots.map((slot) => (
        <details key={slot.createdAt} className="mt-3 border-t border-jarvis-border pt-3">
          <summary className="text-[12px] text-jarvis-text-faint cursor-pointer hover:text-jarvis-text-dim transition-colors font-mono">
            {slot.label}
          </summary>
          <div
            className="mt-2 text-[13px] text-jarvis-text-dim leading-relaxed whitespace-pre-line opacity-80"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(slot.synthesis) }}
          />
        </details>
      ))}
    </div>
  );
}

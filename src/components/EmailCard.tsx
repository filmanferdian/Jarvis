'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import { renderMarkdown } from '@/lib/renderMarkdown';

interface SlotData {
  timeSlot: string;
  label: string;
  synthesis: string;
  importantCount?: number;
  deadlineCount?: number;
  createdAt?: string;
}

interface PreviousSynthesis {
  date: string;
  timeSlot: string;
  synthesis: string;
  importantCount?: number;
  createdAt?: string;
}

interface EmailData {
  date: string;
  synthesis: string | null;
  timeSlot?: string;
  importantCount?: number;
  deadlineCount?: number;
  createdAt?: string;
  slots?: SlotData[];
  previous?: PreviousSynthesis | null;
  message?: string;
}

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export default function EmailCard() {
  const { data, loading } = usePolling<EmailData>(
    () => fetchAuth('/api/emails'),
    5 * 60 * 1000
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

  if (!data?.synthesis) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <h2 className="text-base font-medium text-jarvis-text-muted mb-2">
          Email Digest
        </h2>
        <p className="text-base text-jarvis-text-dim">
          {data?.message || 'No email synthesis available yet.'}
        </p>
      </div>
    );
  }

  const slots = data.slots ?? [];
  // The latest slot is shown expanded by default; older slots are collapsible
  const latestSlot = slots.length > 0 ? slots[0] : null;
  const olderSlots = slots.slice(1);

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-medium text-jarvis-text-primary">
          Email Digest
        </h2>
        <div className="flex items-center gap-3">
          {latestSlot && (
            <span className="text-sm font-mono text-jarvis-accent">
              {latestSlot.label}
            </span>
          )}
          {(data.importantCount ?? 0) > 0 && (
            <span className="text-sm font-mono text-jarvis-warn">
              {data.importantCount} important
            </span>
          )}
          {(data.deadlineCount ?? 0) > 0 && (
            <span className="text-sm font-mono text-red-400">
              {data.deadlineCount} deadline{data.deadlineCount !== 1 ? 's' : ''}
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
          {expanded ? 'Hide synthesis' : 'Show synthesis'}
        </span>
      </button>

      {expanded && (
        <>
          {/* Latest slot */}
          <div
            className="mt-3 text-base text-jarvis-text-secondary whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(data.synthesis) }}
          />

          {/* Older today's slots */}
          {olderSlots.map((slot) => (
            <details key={slot.timeSlot} className="mt-4 border-t border-jarvis-border pt-3">
              <summary className="text-sm text-jarvis-text-muted cursor-pointer hover:text-jarvis-text-secondary transition-colors">
                {slot.label}
              </summary>
              <div
                className="mt-2 text-base text-jarvis-text-secondary whitespace-pre-line opacity-80"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(slot.synthesis) }}
              />
            </details>
          ))}

        </>
      )}
    </div>
  );
}

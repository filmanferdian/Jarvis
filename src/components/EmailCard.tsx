'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import { renderMarkdown } from '@/lib/renderMarkdown';
import Link from 'next/link';

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

interface TriageSummary {
  total: number;
  need_response: number;
  drafts_created: number;
}

interface TriageData {
  date: string;
  summary: TriageSummary;
}

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

function getWibTimeSlotLabel(): string {
  const wibOffset = 7 * 60 * 60 * 1000;
  const wib = new Date(Date.now() + wibOffset);
  const hour = wib.getUTCHours();
  if (hour >= 5 && hour < 11) return 'Morning';
  if (hour >= 11 && hour < 17) return 'Afternoon';
  return 'Evening';
}

export default function EmailCard() {
  const { data, loading } = usePolling<EmailData>(
    () => fetchAuth('/api/emails'),
    5 * 60 * 1000
  );

  const { data: triageData } = usePolling<TriageData>(
    () => fetchAuth('/api/emails/triage'),
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

      {/* Triage summary strip */}
      {triageData && triageData.summary.total > 0 && (
        <Link
          href="/emails"
          className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-jarvis-bg border border-jarvis-border/50 hover:border-jarvis-accent/30 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-jarvis-accent" />
            <span className="text-xs font-mono text-jarvis-accent font-medium">
              {triageData.summary.need_response}
            </span>
            <span className="text-[11px] text-jarvis-text-muted">need response</span>
          </div>
          <span className="text-jarvis-border">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-jarvis-success" />
            <span className="text-xs font-mono text-jarvis-success font-medium">
              {triageData.summary.drafts_created}
            </span>
            <span className="text-[11px] text-jarvis-text-muted">drafted</span>
          </div>
          <span className="text-jarvis-border">|</span>
          <span className="text-[11px] text-jarvis-text-dim">
            {triageData.summary.total} total
          </span>
          <span className="ml-auto text-[10px] font-mono text-jarvis-text-dim">
            {triageData.date} {getWibTimeSlotLabel()}
          </span>
          <svg className="w-3 h-3 text-jarvis-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

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

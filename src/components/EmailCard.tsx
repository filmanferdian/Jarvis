'use client';

import Link from 'next/link';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';

interface TriageEmail {
  from_name: string | null;
  from_address: string;
  subject: string;
  source: string;
  draft_created: boolean;
  draft_snippet: string | null;
  category_reason: string | null;
  received_at: string;
  body_snippet: string | null;
}

interface TriageSummary {
  total: number;
  need_response: number;
  drafts_created: number;
}

interface TriageData {
  date: string;
  lastRefreshedAt: string | null;
  summary: TriageSummary;
  needResponse: TriageEmail[];
}

function formatWibTime(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  const h = String(wib.getUTCHours()).padStart(2, '0');
  const m = String(wib.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function initials(name: string | null, address: string): string {
  const base = (name && name.trim()) || address.split('@')[0];
  const parts = base.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function EmailCard() {
  const { data, loading } = usePolling<TriageData>(
    () => fetchAuth('/api/emails/triage'),
    5 * 60 * 1000,
  );

  if (loading) {
    return (
      <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
          <div className="h-3 bg-jarvis-border rounded w-4/5" />
        </div>
      </div>
    );
  }

  const threads = groupBySender(data?.needResponse ?? []).slice(0, 3);

  return (
    <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[15px] text-jarvis-text-primary" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          Needs response
        </h2>
        {data && (
          <span className="text-[11px] font-mono text-jarvis-text-faint">
            {data.summary.need_response} today · {data.summary.drafts_created} drafted
          </span>
        )}
      </div>

      {threads.length === 0 ? (
        <p className="text-[13px] text-jarvis-text-dim">Inbox is clear. No replies owed today.</p>
      ) : (
        <div className="space-y-2.5">
          {threads.map((t) => (
            <div
              key={t.key}
              className="flex items-start gap-3 p-3 rounded-[10px] border border-jarvis-border bg-jarvis-bg-elevated"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--color-jarvis-ambient), var(--color-jarvis-aurora))',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {initials(t.from_name, t.from_address)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] text-jarvis-text-primary font-medium truncate">
                    {t.from_name || t.from_address}
                  </p>
                  <span className="text-[10.5px] font-mono text-jarvis-text-faint shrink-0">
                    {formatWibTime(t.latestReceivedAt)}
                  </span>
                </div>
                <p className="text-[12px] text-jarvis-text-dim truncate mt-0.5">{t.subject}</p>
                {t.draft_snippet && (
                  <p className="text-[11.5px] text-jarvis-text-faint truncate mt-1 italic">
                    Draft ready · {t.draft_snippet.slice(0, 80)}…
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/emails"
        className="inline-flex items-center gap-1 mt-4 text-[12px]"
        style={{ color: 'var(--color-jarvis-cta)' }}
      >
        Open Email Triage
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

interface GroupedThread {
  key: string;
  from_name: string | null;
  from_address: string;
  subject: string;
  latestReceivedAt: string;
  draft_snippet: string | null;
}

function groupBySender(emails: TriageEmail[]): GroupedThread[] {
  const byAddr = new Map<string, GroupedThread>();
  for (const e of emails) {
    const existing = byAddr.get(e.from_address);
    if (!existing) {
      byAddr.set(e.from_address, {
        key: e.from_address,
        from_name: e.from_name,
        from_address: e.from_address,
        subject: e.subject,
        latestReceivedAt: e.received_at,
        draft_snippet: e.draft_snippet,
      });
    } else if (new Date(e.received_at) > new Date(existing.latestReceivedAt)) {
      existing.subject = e.subject;
      existing.latestReceivedAt = e.received_at;
      existing.draft_snippet = e.draft_snippet ?? existing.draft_snippet;
    }
  }
  return Array.from(byAddr.values()).sort(
    (a, b) => new Date(b.latestReceivedAt).getTime() - new Date(a.latestReceivedAt).getTime(),
  );
}

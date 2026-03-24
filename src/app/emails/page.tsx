'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';

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

interface OtherEmail {
  from_address: string;
  from_name: string | null;
  subject: string;
  category: string;
  source: string;
  received_at: string;
}

interface TriageSummary {
  total: number;
  need_response: number;
  informational: number;
  newsletter: number;
  notification: number;
  automated: number;
  drafts_created: number;
}

interface TriageData {
  date: string;
  summary: TriageSummary;
  needResponse: TriageEmail[];
  otherEmails: OtherEmail[];
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  informational: { bg: 'bg-jarvis-bg-elevated', text: 'text-jarvis-text-muted', label: 'Info' },
  newsletter: { bg: 'bg-jarvis-bg-elevated', text: 'text-jarvis-text-dim', label: 'Newsletter' },
  notification: { bg: 'bg-amber-500/10', text: 'text-jarvis-warn', label: 'Notification' },
  automated: { bg: 'bg-jarvis-bg-elevated', text: 'text-jarvis-text-dim', label: 'Automated' },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const h = wib.getUTCHours().toString().padStart(2, '0');
  const m = wib.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function sourceLabel(source: string): string {
  if (source === 'outlook') return 'Outlook';
  if (source.startsWith('gmail:')) return 'Gmail';
  return source;
}

export default function EmailTriagePage() {
  const [data, setData] = useState<TriageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showOther, setShowOther] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchAuth<TriageData>('/api/emails/triage');
      setData(result);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 10 minutes to pick up new triage runs
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const summary = data?.summary;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-jarvis-text-muted">
          <a href="/" className="hover:text-jarvis-accent transition-colors">Dashboard</a>
          <span>/</span>
          <span className="text-jarvis-text-primary">Email Triage</span>
          {data && (
            <span className="ml-auto text-xs font-mono text-jarvis-text-dim">{data.date}</span>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4 animate-pulse">
                <div className="h-6 bg-jarvis-border/50 rounded w-12 mb-2" />
                <div className="h-3 bg-jarvis-border/50 rounded w-20" />
              </div>
            ))
          ) : (
            <>
              <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
                <p className="text-2xl font-mono font-semibold text-jarvis-text-primary">{summary?.total ?? 0}</p>
                <p className="text-[11px] text-jarvis-text-dim uppercase mt-1">Total Scanned</p>
              </div>
              <div className="rounded-xl border border-jarvis-accent/30 bg-jarvis-accent/5 p-4">
                <p className="text-2xl font-mono font-semibold text-jarvis-accent">{summary?.need_response ?? 0}</p>
                <p className="text-[11px] text-jarvis-accent/70 uppercase mt-1">Need Response</p>
              </div>
              <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
                <p className="text-2xl font-mono font-semibold text-jarvis-success">{summary?.drafts_created ?? 0}</p>
                <p className="text-[11px] text-jarvis-text-dim uppercase mt-1">Drafts Created</p>
              </div>
              <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
                <p className="text-2xl font-mono font-semibold text-jarvis-text-muted">
                  {(summary?.total ?? 0) - (summary?.need_response ?? 0)}
                </p>
                <p className="text-[11px] text-jarvis-text-dim uppercase mt-1">Other</p>
              </div>
            </>
          )}
        </div>

        {/* Need Response Section */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
          <h2 className="text-[15px] font-medium text-jarvis-text-primary mb-4">
            Needs Response
            {summary && summary.need_response > 0 && (
              <span className="ml-2 text-xs font-mono text-jarvis-accent bg-jarvis-accent/10 px-2 py-0.5 rounded-full">
                {summary.need_response}
              </span>
            )}
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-jarvis-border/50 rounded animate-pulse" />
              ))}
            </div>
          ) : !data || data.needResponse.length === 0 ? (
            <p className="text-sm text-jarvis-text-dim">No emails requiring response today.</p>
          ) : (
            <div className="space-y-0">
              {data.needResponse.map((email, idx) => (
                <div key={idx}>
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border-l-2 border-l-jarvis-accent hover:bg-jarvis-bg-hover transition-colors text-left"
                  >
                    {/* Draft status dot */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${email.draft_created ? 'bg-jarvis-success' : 'bg-jarvis-text-dim'}`}
                      title={email.draft_created ? 'Draft created' : 'No draft'}
                    />

                    {/* From + Subject */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-jarvis-text-primary truncate">
                        <span className="font-medium">{email.from_name || email.from_address}</span>
                        {email.from_name && (
                          <span className="text-jarvis-text-dim ml-1.5 text-[11px]">{email.from_address}</span>
                        )}
                      </p>
                      <p className="text-[12px] text-jarvis-text-secondary truncate">{email.subject}</p>
                    </div>

                    {/* Source badge */}
                    <span className="text-[10px] font-mono text-jarvis-text-dim px-1.5 py-0.5 border border-jarvis-border/50 rounded shrink-0">
                      {sourceLabel(email.source)}
                    </span>

                    {/* Time */}
                    <span className="text-[11px] font-mono text-jarvis-text-dim shrink-0">
                      {formatTime(email.received_at)}
                    </span>

                    {/* Expand chevron */}
                    <svg
                      className={`w-3.5 h-3.5 text-jarvis-text-dim shrink-0 transition-transform ${expandedIdx === idx ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded content */}
                  {expandedIdx === idx && (
                    <div className="ml-8 mr-3 mb-3 space-y-3">
                      {email.category_reason && (
                        <p className="text-[11px] text-jarvis-text-dim italic">{email.category_reason}</p>
                      )}
                      {email.body_snippet && (
                        <div className="p-3 rounded-lg bg-jarvis-bg border border-jarvis-border/50">
                          <p className="text-[10px] uppercase text-jarvis-text-dim mb-1.5 font-medium">Original</p>
                          <p className="text-[12px] text-jarvis-text-muted whitespace-pre-wrap leading-relaxed">
                            {email.body_snippet}
                          </p>
                        </div>
                      )}
                      {email.draft_created && email.draft_snippet && (
                        <div className="p-3 rounded-lg bg-jarvis-accent/5 border border-jarvis-accent/20">
                          <p className="text-[10px] uppercase text-jarvis-accent/70 mb-1.5 font-medium">Draft Reply</p>
                          <p className="text-[12px] text-jarvis-text-secondary whitespace-pre-wrap leading-relaxed">
                            {email.draft_snippet}
                          </p>
                        </div>
                      )}
                      {!email.draft_created && (
                        <p className="text-[11px] text-jarvis-text-dim">
                          Draft not created — check email app for manual response.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Other Emails Section (collapsible) */}
        {data && data.otherEmails.length > 0 && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
            <button
              onClick={() => setShowOther(!showOther)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-[15px] font-medium text-jarvis-text-primary">
                Other Emails
                <span className="ml-2 text-xs font-mono text-jarvis-text-dim">
                  {data.otherEmails.length}
                </span>
              </h2>
              <svg
                className={`w-4 h-4 text-jarvis-text-dim transition-transform ${showOther ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showOther && (
              <div className="mt-4 space-y-1">
                {data.otherEmails.map((email, idx) => {
                  const style = CATEGORY_STYLES[email.category] || CATEGORY_STYLES.automated;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 py-2 px-1 border-b border-jarvis-border/30 last:border-b-0"
                    >
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text} shrink-0`}>
                        {style.label}
                      </span>
                      <span className="text-[12px] text-jarvis-text-muted truncate flex-1">
                        {email.subject}
                      </span>
                      <span className="text-[10px] text-jarvis-text-dim shrink-0 hidden sm:block">
                        {email.from_name || email.from_address}
                      </span>
                      <span className="text-[10px] font-mono text-jarvis-text-dim shrink-0">
                        {formatTime(email.received_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && data && data.summary.total === 0 && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-8 text-center">
            <p className="text-sm text-jarvis-text-dim">No emails triaged today yet.</p>
            <p className="text-xs text-jarvis-text-dim mt-1">Triage runs at 7am, 1pm, and 7pm WIB.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

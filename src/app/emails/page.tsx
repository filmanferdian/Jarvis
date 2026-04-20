'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';
import EmailThread, { Thread } from '@/components/EmailThread';

interface TriageEmail {
  from_name: string | null;
  from_address: string;
  subject: string;
  source: string;
  draft_created: boolean;
  draft_snippet: string | null;
  draft_skipped_reason: string | null;
  category_reason: string | null;
  received_at: string;
  body_snippet: string | null;
}

interface BlocklistEntry {
  id: string;
  pattern: string;
  reason: string | null;
  created_at: string;
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
  lastRefreshedAt: string | null;
  summary: TriageSummary;
  needResponse: TriageEmail[];
  otherEmails: OtherEmail[];
}

type Tab = 'needs' | 'other' | 'blocked';

const TAB_LABELS: Record<Tab, string> = {
  needs: 'Needs response',
  other: 'Other',
  blocked: 'Blocked',
};

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

function sourceLabel(source: string): string {
  if (source === 'outlook') return 'Outlook';
  if (source.startsWith('gmail:')) return 'Gmail';
  return source;
}

interface ListRow {
  key: string;
  from_name: string | null;
  from_address: string;
  subject: string;
  source: string;
  preview: string;
  receivedAt: string;
  draftReady: boolean;
  draftSkipped: boolean;
  category?: string;
}

export default function EmailTriagePage() {
  const [data, setData] = useState<TriageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('needs');
  const [selected, setSelected] = useState<string | null>(null);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [newPattern, setNewPattern] = useState('');
  const [newReason, setNewReason] = useState('');
  const [blocklistBusy, setBlocklistBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchAuth<TriageData>('/api/emails/triage');
      setData(result);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBlocklist = useCallback(async () => {
    try {
      const result = await fetchAuth<{ entries: BlocklistEntry[] }>('/api/emails/blocklist');
      setBlocklist(result.entries);
    } catch {
      /* silent */
    }
  }, []);

  const addBlocklistEntry = async () => {
    if (!newPattern.trim()) return;
    setBlocklistBusy(true);
    try {
      await fetchAuth('/api/emails/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: newPattern.trim(), reason: newReason.trim() || null }),
      });
      setNewPattern('');
      setNewReason('');
      await loadBlocklist();
    } catch {
      /* silent */
    } finally {
      setBlocklistBusy(false);
    }
  };

  const removeBlocklistEntry = async (id: string) => {
    setBlocklistBusy(true);
    try {
      await fetchAuth(`/api/emails/blocklist?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadBlocklist();
    } catch {
      /* silent */
    } finally {
      setBlocklistBusy(false);
    }
  };

  useEffect(() => {
    load();
    loadBlocklist();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load, loadBlocklist]);

  // Build list rows based on active tab
  const rows: ListRow[] = useMemo(() => {
    if (!data) return [];
    if (tab === 'needs') {
      return groupNeedsResponse(data.needResponse);
    }
    if (tab === 'other') {
      return data.otherEmails.map((e) => ({
        key: `${e.from_address}__${e.received_at}`,
        from_name: e.from_name,
        from_address: e.from_address,
        subject: e.subject,
        source: e.source,
        preview: '',
        receivedAt: e.received_at,
        draftReady: false,
        draftSkipped: false,
        category: e.category,
      }));
    }
    return [];
  }, [data, tab]);

  // When rows change, make sure selection is valid
  useEffect(() => {
    if (rows.length === 0) {
      setSelected(null);
    } else if (!selected || !rows.find((r) => r.key === selected)) {
      setSelected(rows[0].key);
    }
  }, [rows, selected]);

  const selectedThread: Thread | null = useMemo(() => {
    if (!data || tab !== 'needs' || !selected) return null;
    const msgs = data.needResponse.filter((e) => e.from_address === selected);
    if (msgs.length === 0) return null;
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
    );
    const latest = sorted[sorted.length - 1];
    return {
      key: latest.from_address,
      from_name: latest.from_name,
      from_address: latest.from_address,
      subject: latest.subject,
      source: latest.source,
      messages: sorted.map((m) => ({
        from_name: m.from_name,
        from_address: m.from_address,
        subject: m.subject,
        received_at: m.received_at,
        body_snippet: m.body_snippet,
        source: m.source,
      })),
      draft_snippet: latest.draft_snippet,
      draft_skipped_reason: latest.draft_skipped_reason,
    };
  }, [data, tab, selected]);

  const summary = data?.summary;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-baseline justify-between">
          <div>
            <h1
              className="text-[22px] text-jarvis-text-primary"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              Email Triage
            </h1>
            <p className="text-[12px] text-jarvis-text-dim mt-0.5">
              {summary?.total ?? 0} scanned · {summary?.need_response ?? 0} need response ·{' '}
              {summary?.drafts_created ?? 0} drafted
            </p>
          </div>
          {data && (
            <span className="text-[11px] font-mono text-jarvis-text-faint">
              {data.date}
              {data.lastRefreshedAt && ` · Updated ${formatWibTime(data.lastRefreshedAt)} WIB`}
            </span>
          )}
        </div>

        {/* Split pane */}
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: '400px 1fr', height: 'calc(100vh - 180px)' }}
        >
          {/* List */}
          <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="flex gap-1 px-3 py-2.5 border-b border-jarvis-border">
              {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
                const active = tab === t;
                const count =
                  t === 'needs'
                    ? summary?.need_response ?? 0
                    : t === 'other'
                      ? (summary?.total ?? 0) - (summary?.need_response ?? 0)
                      : blocklist.length;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-3 py-1.5 text-[12px] rounded-[8px] transition-colors"
                    style={{
                      background: active ? 'var(--color-jarvis-cta-soft)' : 'transparent',
                      color: active ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-text-dim)',
                    }}
                  >
                    {TAB_LABELS[t]}
                    <span className="ml-1.5 opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* List body */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 bg-jarvis-border/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : tab === 'blocked' ? (
                <div className="p-4 space-y-3">
                  {blocklist.length === 0 ? (
                    <p className="text-[12.5px] text-jarvis-text-dim">No blocked senders yet.</p>
                  ) : (
                    blocklist.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-[10px] border border-jarvis-border bg-jarvis-bg-elevated"
                      >
                        <span className="text-[12px] font-mono text-jarvis-text-primary">
                          {entry.pattern}
                        </span>
                        {entry.reason && (
                          <span className="text-[11px] text-jarvis-text-dim truncate flex-1">
                            {entry.reason}
                          </span>
                        )}
                        {!entry.reason && <span className="flex-1" />}
                        <button
                          onClick={() => removeBlocklistEntry(entry.id)}
                          disabled={blocklistBusy}
                          className="text-[11px] text-jarvis-text-dim hover:text-jarvis-danger transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}

                  <div className="flex flex-col gap-2 pt-3 border-t border-jarvis-border">
                    <input
                      type="text"
                      placeholder="Pattern (e.g. kantorku)"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      className="px-3 py-2 text-[12px] bg-jarvis-bg border border-jarvis-border rounded-[8px] text-jarvis-text-primary placeholder:text-jarvis-text-faint focus:outline-none focus:border-jarvis-cta"
                    />
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      className="px-3 py-2 text-[12px] bg-jarvis-bg border border-jarvis-border rounded-[8px] text-jarvis-text-primary placeholder:text-jarvis-text-faint focus:outline-none focus:border-jarvis-cta"
                    />
                    <button
                      onClick={addBlocklistEntry}
                      disabled={blocklistBusy || !newPattern.trim()}
                      className="px-3 py-2 text-[12px] rounded-[8px] text-white transition-colors disabled:opacity-50"
                      style={{ background: 'var(--color-jarvis-cta)' }}
                    >
                      Add pattern
                    </button>
                    <p className="text-[10.5px] text-jarvis-text-faint">
                      Matched as case-insensitive substring on the sender address.
                    </p>
                  </div>
                </div>
              ) : rows.length === 0 ? (
                <p className="p-6 text-[12.5px] text-jarvis-text-dim">
                  {tab === 'needs' ? 'No emails requiring response today.' : 'Nothing else in today\u2019s scan.'}
                </p>
              ) : (
                rows.map((row) => {
                  const active = selected === row.key;
                  return (
                    <button
                      key={row.key}
                      onClick={() => setSelected(row.key)}
                      className="w-full text-left block px-4 py-3.5 border-b border-jarvis-border transition-colors"
                      style={{
                        background: active
                          ? 'var(--color-jarvis-ambient-soft)'
                          : 'transparent',
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-jarvis-text-primary truncate">
                          {row.from_name || row.from_address}
                        </span>
                        <span
                          className="text-[10.5px] text-jarvis-text-faint shrink-0"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {formatWibTime(row.receivedAt)}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-jarvis-text-dim mt-1 truncate">{row.subject}</p>
                      {row.preview && (
                        <p className="text-[11.5px] text-jarvis-text-faint mt-1.5 truncate">
                          {row.preview}
                        </p>
                      )}
                      <div className="flex gap-1.5 mt-1.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full border border-jarvis-border text-jarvis-text-faint"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {sourceLabel(row.source)}
                        </span>
                        {row.draftReady && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'var(--color-jarvis-ambient-soft)',
                              color: 'var(--color-jarvis-ambient)',
                            }}
                          >
                            Draft ready
                          </span>
                        )}
                        {row.draftSkipped && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(192,122,30,0.12)',
                              color: 'var(--color-jarvis-warn)',
                            }}
                          >
                            Action only
                          </span>
                        )}
                        {row.category && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full text-jarvis-text-faint capitalize"
                            style={{ background: 'var(--color-jarvis-track)' }}
                          >
                            {row.category.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card overflow-y-auto flex flex-col">
            {tab === 'needs' && selectedThread ? (
              <EmailThread thread={selectedThread} />
            ) : tab === 'other' && selected && data ? (
              <OtherEmailDetail row={rows.find((r) => r.key === selected)!} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[12.5px] text-jarvis-text-dim">
                  {tab === 'blocked'
                    ? 'Manage sender patterns on the left.'
                    : 'Select an email to view the thread.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function OtherEmailDetail({ row }: { row: ListRow }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 pb-5 border-b border-jarvis-border">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[15px] font-semibold"
          style={{
            background: 'linear-gradient(135deg, var(--color-jarvis-ambient), var(--color-jarvis-aurora))',
            fontFamily: 'var(--font-display)',
          }}
        >
          {initials(row.from_name, row.from_address)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] text-jarvis-text-primary truncate">
            {row.from_name || row.from_address}
          </h3>
          <p className="text-[12px] text-jarvis-text-faint truncate">{row.subject}</p>
        </div>
        <span
          className="text-[10.5px] font-mono text-jarvis-text-faint"
        >
          {formatWibTime(row.receivedAt)} WIB
        </span>
      </div>
      <div className="py-5">
        <p className="text-[11px] uppercase text-jarvis-text-faint mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
          Category · {row.category?.replace('_', ' ')}
        </p>
        <p className="text-[13px] text-jarvis-text-dim">
          No response needed. Classified automatically by the triage cron.
        </p>
      </div>
    </div>
  );
}

function groupNeedsResponse(emails: TriageEmail[]): ListRow[] {
  const byAddr = new Map<string, ListRow>();
  for (const e of emails) {
    const existing = byAddr.get(e.from_address);
    const row: ListRow = {
      key: e.from_address,
      from_name: e.from_name,
      from_address: e.from_address,
      subject: e.subject,
      source: e.source,
      preview: e.body_snippet?.replace(/\s+/g, ' ').slice(0, 140) ?? '',
      receivedAt: e.received_at,
      draftReady: e.draft_created,
      draftSkipped: !e.draft_created && !!e.draft_skipped_reason,
    };
    if (!existing || new Date(e.received_at) > new Date(existing.receivedAt)) {
      byAddr.set(e.from_address, row);
    }
  }
  return Array.from(byAddr.values()).sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}

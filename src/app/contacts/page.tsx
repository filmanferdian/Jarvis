'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';

interface ScannedContact {
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  first_seen_date: string;
  last_seen_date: string;
  event_count: number;
  sources: string[];
  status: 'new' | 'existing' | 'synced' | 'ignored';
  notion_page_id: string | null;
}

interface ContactsData {
  contacts: ScannedContact[];
  summary: {
    total: number;
    new_count: number;
    existing_count: number;
    synced_count: number;
  };
  lastRefreshedAt: string | null;
}

interface ScanResult {
  new_contacts: number;
  updated_existing: number;
  total_events_scanned: number;
  errors?: string[];
}

type Filter = 'all' | 'pending' | 'existing' | 'ignored';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  pending: 'Pending triage',
  existing: 'In Notion',
  ignored: 'Ignored',
};

function formatWibDateTime(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const mo = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  const h = String(wib.getUTCHours()).padStart(2, '0');
  const mi = String(wib.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

function initials(name: string | null, email: string): string {
  const base = (name && name.trim()) || email.split('@')[0];
  const parts = base.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

// Render a bar chart of "touches" (meetings) bucketed by recency.
// Returns 12 bars (weeks), height encoded by proportion of events in that week.
function touchBars(contact: ScannedContact): { opacity: number; recent: boolean }[] {
  const totalWeeks = 12;
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const lastSeen = new Date(contact.last_seen_date).getTime();
  const weeksAgo = Math.max(0, Math.floor((now - lastSeen) / weekMs));

  const bars: number[] = Array.from({ length: totalWeeks }, (_, i) => (i === weeksAgo ? 1 : 0));
  if (weeksAgo < totalWeeks && bars[weeksAgo] === 0) {
    bars[weeksAgo] = 1;
  }
  // Reverse so index 0 = 12 weeks ago, last = most recent
  bars.reverse();
  return bars.map((v, i) => ({
    opacity: v > 0 ? 0.9 : 0.3,
    recent: totalWeeks - 1 - i === weeksAgo,
  }));
}

function suggestion(contact: ScannedContact): string | null {
  const days = daysBetween(contact.last_seen_date, new Date().toISOString());
  if (contact.status === 'new') {
    return `New contact. ${contact.event_count} meeting${contact.event_count !== 1 ? 's' : ''} captured — worth adding to Notion.`;
  }
  if (days > 60) return `No contact in ${days} days. Consider a quick check-in.`;
  if (days > 30) return `Last seen ${days} days ago. Light follow-up may be timely.`;
  return null;
}

export default function ContactsPage() {
  const [data, setData] = useState<ContactsData | null>(null);
  const [ignoredContacts, setIgnoredContacts] = useState<ScannedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ignoring, setIgnoring] = useState(false);
  const [filter, setFilter] = useState<Filter>('pending');

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts?filter=all', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIgnored = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts?filter=ignored', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setIgnoredContacts(json.contacts || []);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchIgnored();
  }, [fetchContacts, fetchIgnored]);

  const handleScan = async (mode: 'backfill' | 'weekly') => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/contacts/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        const result = await res.json();
        setScanResult(result);
        await fetchContacts();
      }
    } catch {
      /* silent */
    } finally {
      setScanning(false);
    }
  };

  const handleSync = async () => {
    if (selected.size === 0) return;
    setSyncing(true);
    try {
      const contactsToSync = (data?.contacts || [])
        .filter((c) => selected.has(c.email) && c.status === 'new')
        .map((c) => ({
          email: c.email,
          name: c.name || c.email.split('@')[0],
          company: c.company,
          last_seen_date: c.last_seen_date,
        }));
      const res = await fetch('/api/contacts/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contacts: contactsToSync }),
      });
      if (res.ok) {
        setSelected(new Set());
        await fetchContacts();
      }
    } catch {
      /* silent */
    } finally {
      setSyncing(false);
    }
  };

  const handleIgnore = async () => {
    if (selected.size === 0) return;
    setIgnoring(true);
    try {
      const emails = Array.from(selected).filter((email) =>
        (data?.contacts || []).some((c) => c.email === email && c.status === 'new'),
      );
      const res = await fetch('/api/contacts/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emails }),
      });
      if (res.ok) {
        setSelected(new Set());
        await fetchContacts();
        await fetchIgnored();
      }
    } catch {
      /* silent */
    } finally {
      setIgnoring(false);
    }
  };

  const handleRestore = async (email: string) => {
    try {
      const res = await fetch('/api/contacts/ignore', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        await fetchContacts();
        await fetchIgnored();
      }
    } catch {
      /* silent */
    }
  };

  const toggleSelect = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const all = data?.contacts ?? [];
  const filtered =
    filter === 'pending'
      ? all.filter((c) => c.status === 'new')
      : filter === 'existing'
        ? all.filter((c) => c.status === 'existing')
        : filter === 'ignored'
          ? ignoredContacts
          : all;

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
              Contacts
            </h1>
            <p className="text-[12px] text-jarvis-text-dim mt-0.5">
              External contacts from calendar invites
            </p>
            {data?.lastRefreshedAt && (
              <p className="text-[11px] font-mono text-jarvis-text-faint mt-0.5">
                Last refreshed {formatWibDateTime(data.lastRefreshedAt)} WIB
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleScan('weekly')}
              disabled={scanning}
              className="px-3.5 py-1.5 text-[12px] rounded-[8px] text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-jarvis-cta)' }}
            >
              {scanning ? 'Scanning…' : 'Scan weekly'}
            </button>
            <button
              onClick={() => handleScan('backfill')}
              disabled={scanning}
              className="px-3.5 py-1.5 text-[12px] rounded-[8px] border border-jarvis-border text-jarvis-text-dim hover:bg-jarvis-bg-deep transition-colors disabled:opacity-50"
            >
              Backfill 4w
            </button>
          </div>
        </div>

        {/* Scan result toast */}
        {scanResult && (
          <div
            className="rounded-[10px] p-3 text-[12px] text-jarvis-text-primary"
            style={{
              background: 'var(--color-jarvis-ambient-soft)',
              border: '1px solid var(--color-jarvis-ambient-soft)',
            }}
          >
            Scanned {scanResult.total_events_scanned} events. {scanResult.new_contacts} new
            contacts, {scanResult.updated_existing} existing updated.
            {scanResult.errors && scanResult.errors.length > 0 && (
              <span className="text-jarvis-warn ml-1">
                ({scanResult.errors.length} error{scanResult.errors.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        )}

        {/* Summary + filter chips */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => {
            const active = filter === f;
            const count =
              f === 'pending'
                ? data?.summary.new_count ?? 0
                : f === 'existing'
                  ? data?.summary.existing_count ?? 0
                  : f === 'ignored'
                    ? ignoredContacts.length
                    : data?.summary.total ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-[12px] rounded-full border transition-colors"
                style={{
                  background: active ? 'var(--color-jarvis-cta-soft)' : 'transparent',
                  borderColor: active ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-border)',
                  color: active ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-text-dim)',
                }}
              >
                {FILTER_LABELS[f]}
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Bulk actions bar (pending filter only) */}
        {filter === 'pending' && selected.size > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-[10px]"
            style={{ background: 'var(--color-jarvis-ambient-soft)' }}
          >
            <span className="text-[12px]" style={{ color: 'var(--color-jarvis-ambient)' }}>
              {selected.size} selected
            </span>
            <button
              onClick={handleIgnore}
              disabled={ignoring}
              className="ml-auto px-3 py-1.5 text-[12px] rounded-[8px] border border-jarvis-border text-jarvis-text-dim hover:bg-jarvis-bg-deep transition-colors"
            >
              {ignoring ? 'Ignoring…' : 'Ignore'}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 text-[12px] rounded-[8px] text-white transition-colors"
              style={{ background: 'var(--color-jarvis-cta)' }}
            >
              {syncing ? 'Syncing…' : 'Sync to Notion'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5 animate-pulse h-32"
              />
            ))}
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <ContactCard
                key={c.email}
                contact={c}
                selected={selected.has(c.email)}
                onToggle={filter === 'pending' ? () => toggleSelect(c.email) : undefined}
                onRestore={filter === 'ignored' ? () => handleRestore(c.email) : undefined}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-10 text-center">
            <p className="text-[13px] text-jarvis-text-dim">
              {filter === 'pending'
                ? 'Nothing pending triage right now.'
                : filter === 'ignored'
                  ? 'No ignored contacts.'
                  : 'No contacts scanned yet.'}
            </p>
            {filter === 'all' && (
              <p className="text-[11.5px] text-jarvis-text-faint mt-2">
                Run &ldquo;Backfill 4w&rdquo; to scan the past 4 weeks of calendar invites.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ContactCard({
  contact,
  selected,
  onToggle,
  onRestore,
}: {
  contact: ScannedContact;
  selected: boolean;
  onToggle?: () => void;
  onRestore?: () => void;
}) {
  const bars = touchBars(contact);
  const sug = suggestion(contact);
  return (
    <div
      className="rounded-[14px] border bg-jarvis-bg-card p-5 flex gap-4 items-start transition-colors"
      style={{
        borderColor: selected
          ? 'var(--color-jarvis-ambient)'
          : 'var(--color-jarvis-border)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[14px] font-semibold shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--color-jarvis-ambient), var(--color-jarvis-aurora))',
          fontFamily: 'var(--font-display)',
        }}
      >
        {initials(contact.name, contact.email)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[15px] font-medium text-jarvis-text-primary truncate">
            {contact.name || contact.email.split('@')[0]}
          </p>
          {onToggle && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label="Select"
              className="shrink-0 accent-jarvis-ambient"
            />
          )}
          {onRestore && (
            <button
              onClick={onRestore}
              className="text-[11px]"
              style={{ color: 'var(--color-jarvis-cta)' }}
            >
              Restore
            </button>
          )}
        </div>
        <p className="text-[12px] text-jarvis-text-faint truncate mt-0.5">
          {contact.company || 'Unknown company'} · {contact.email}
        </p>

        {/* Touch history */}
        <div className="flex gap-[3px] items-end mt-3 h-6">
          {bars.map((b, i) => (
            <div
              key={i}
              className="w-1 rounded-sm"
              style={{
                height: b.recent ? '100%' : '60%',
                background: b.recent
                  ? 'var(--color-jarvis-ambient)'
                  : 'var(--color-jarvis-border-strong)',
                opacity: b.opacity,
              }}
            />
          ))}
        </div>

        <div
          className="flex items-baseline gap-3 mt-2 text-[11px] text-jarvis-text-faint"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span>{contact.event_count} meeting{contact.event_count !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>last {contact.last_seen_date}</span>
        </div>

        {sug && (
          <p
            className="mt-2 text-[12px] italic"
            style={{ color: 'var(--color-jarvis-ambient)' }}
          >
            {sug}
          </p>
        )}
      </div>
    </div>
  );
}

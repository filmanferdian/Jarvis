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
  status: 'new' | 'existing' | 'synced';
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
}

interface ScanResult {
  new_contacts: number;
  updated_existing: number;
  total_events_scanned: number;
  errors?: string[];
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-jarvis-text-dim mb-1">{label}</p>
      <p className={`text-2xl font-semibold font-mono ${color}`}>{value}</p>
    </div>
  );
}

export default function ContactsPage() {
  const [data, setData] = useState<ContactsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ email: string; field: 'name' | 'company' | 'phone' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts?filter=all', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

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
      // silently fail
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
      // silently fail
    } finally {
      setSyncing(false);
    }
  };

  const startEdit = (email: string, field: 'name' | 'company' | 'phone', currentValue: string | null) => {
    setEditingCell({ email, field });
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    try {
      await fetch('/api/contacts/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: editingCell.email,
          [editingCell.field]: editValue,
        }),
      });
      // Optimistic update
      if (data) {
        const updated = data.contacts.map((c) =>
          c.email === editingCell.email
            ? { ...c, [editingCell.field]: editValue }
            : c,
        );
        setData({ ...data, contacts: updated });
      }
    } catch {
      // silently fail
    }
    setEditingCell(null);
  };

  const toggleSelect = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const newContacts = (data?.contacts || []).filter((c) => c.status === 'new');
    if (selected.size === newContacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(newContacts.map((c) => c.email)));
    }
  };

  const newContacts = (data?.contacts || []).filter((c) => c.status === 'new');
  const existingContacts = (data?.contacts || []).filter((c) => c.status === 'existing');

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-jarvis-text-primary">Contacts</h1>
            <p className="text-xs text-jarvis-text-muted">External contacts from calendar invites</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleScan('weekly')}
              disabled={scanning}
              className="px-3 py-1.5 text-xs rounded-lg bg-jarvis-accent/20 text-jarvis-accent hover:bg-jarvis-accent/30 transition-colors disabled:opacity-50"
            >
              {scanning ? 'Scanning...' : 'Scan Weekly'}
            </button>
            <button
              onClick={() => handleScan('backfill')}
              disabled={scanning}
              className="px-3 py-1.5 text-xs rounded-lg border border-jarvis-border text-jarvis-text-muted hover:bg-jarvis-bg-hover transition-colors disabled:opacity-50"
            >
              Backfill 4w
            </button>
          </div>
        </div>

        {/* Scan result toast */}
        {scanResult && (
          <div className="rounded-lg border border-jarvis-accent/30 bg-jarvis-accent/10 p-3 text-xs text-jarvis-text-secondary">
            Scanned {scanResult.total_events_scanned} events.{' '}
            {scanResult.new_contacts} new contacts, {scanResult.updated_existing} existing updated.
            {scanResult.errors && scanResult.errors.length > 0 && (
              <span className="text-jarvis-warn ml-1">
                ({scanResult.errors.length} error{scanResult.errors.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        )}

        {/* Summary cards */}
        {!loading && data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Scanned" value={data.summary.total} color="text-jarvis-text-primary" />
            <StatCard label="Pending Triage" value={data.summary.new_count} color="text-jarvis-warn" />
            <StatCard label="In Notion" value={data.summary.existing_count} color="text-jarvis-success" />
            <StatCard label="Synced" value={data.summary.synced_count} color="text-jarvis-accent" />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-jarvis-border rounded w-1/4" />
              <div className="h-8 bg-jarvis-border rounded" />
              <div className="h-8 bg-jarvis-border rounded" />
            </div>
          </div>
        )}

        {/* New contacts triage table */}
        {!loading && newContacts.length > 0 && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-medium text-jarvis-text-primary">
                Pending Triage
                <span className="ml-2 text-xs font-mono text-jarvis-warn">
                  {newContacts.length}
                </span>
              </h2>
              <button
                onClick={handleSync}
                disabled={syncing || selected.size === 0}
                className="px-3 py-1.5 text-xs rounded-lg bg-jarvis-accent text-white hover:bg-jarvis-accent/80 transition-colors disabled:opacity-30"
              >
                {syncing ? 'Syncing...' : `Sync ${selected.size} to Notion`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-jarvis-border text-jarvis-text-dim">
                    <th className="pb-2 pr-3 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === newContacts.length && newContacts.length > 0}
                        onChange={toggleSelectAll}
                        className="accent-jarvis-accent"
                      />
                    </th>
                    <th className="pb-2 pr-3 text-left">Name</th>
                    <th className="pb-2 pr-3 text-left">Email</th>
                    <th className="pb-2 pr-3 text-left">Company</th>
                    <th className="pb-2 pr-3 text-left">Phone</th>
                    <th className="pb-2 pr-3 text-left">Last Seen</th>
                    <th className="pb-2 text-right">Meetings</th>
                  </tr>
                </thead>
                <tbody>
                  {newContacts.map((contact) => (
                    <tr
                      key={contact.email}
                      className="border-b border-jarvis-border/50 hover:bg-jarvis-bg-hover transition-colors"
                    >
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.has(contact.email)}
                          onChange={() => toggleSelect(contact.email)}
                          className="accent-jarvis-accent"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {editingCell?.email === contact.email && editingCell.field === 'name' ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="bg-jarvis-bg-elevated border border-jarvis-accent/50 rounded px-1.5 py-0.5 text-xs text-jarvis-text-primary w-full"
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(contact.email, 'name', contact.name)}
                            className="cursor-pointer text-jarvis-text-secondary hover:text-jarvis-accent transition-colors"
                            title="Click to edit"
                          >
                            {contact.name || <span className="italic text-jarvis-text-dim">No name</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-jarvis-text-muted font-mono">
                        {contact.email}
                      </td>
                      <td className="py-2 pr-3">
                        {editingCell?.email === contact.email && editingCell.field === 'company' ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="bg-jarvis-bg-elevated border border-jarvis-accent/50 rounded px-1.5 py-0.5 text-xs text-jarvis-text-primary w-full"
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(contact.email, 'company', contact.company)}
                            className="cursor-pointer text-jarvis-text-secondary hover:text-jarvis-accent transition-colors"
                            title="Click to edit"
                          >
                            {contact.company || <span className="italic text-jarvis-text-dim">Unknown</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {editingCell?.email === contact.email && editingCell.field === 'phone' ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="bg-jarvis-bg-elevated border border-jarvis-accent/50 rounded px-1.5 py-0.5 text-xs text-jarvis-text-primary w-full"
                            placeholder="+62..."
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(contact.email, 'phone', contact.phone || null)}
                            className="cursor-pointer text-jarvis-text-secondary hover:text-jarvis-accent transition-colors"
                            title="Click to edit"
                          >
                            {contact.phone || <span className="italic text-jarvis-text-dim">-</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-jarvis-text-muted font-mono">
                        {contact.last_seen_date}
                      </td>
                      <td className="py-2 text-right text-jarvis-text-muted font-mono">
                        {contact.event_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Existing contacts (already in Notion, Last contact updated) */}
        {!loading && existingContacts.length > 0 && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
            <h2 className="text-[15px] font-medium text-jarvis-text-primary mb-4">
              Existing Contacts Updated
              <span className="ml-2 text-xs font-mono text-jarvis-success">
                {existingContacts.length}
              </span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-jarvis-border text-jarvis-text-dim">
                    <th className="pb-2 pr-3 text-left">Name</th>
                    <th className="pb-2 pr-3 text-left">Email</th>
                    <th className="pb-2 pr-3 text-left">Company</th>
                    <th className="pb-2 pr-3 text-left">Last Seen</th>
                    <th className="pb-2 text-right">Meetings</th>
                  </tr>
                </thead>
                <tbody>
                  {existingContacts.map((contact) => (
                    <tr
                      key={contact.email}
                      className="border-b border-jarvis-border/50 hover:bg-jarvis-bg-hover transition-colors"
                    >
                      <td className="py-2 pr-3 text-jarvis-text-secondary">
                        {contact.name || contact.email.split('@')[0]}
                      </td>
                      <td className="py-2 pr-3 text-jarvis-text-muted font-mono">
                        {contact.email}
                      </td>
                      <td className="py-2 pr-3 text-jarvis-text-muted">
                        {contact.company || '-'}
                      </td>
                      <td className="py-2 pr-3 text-jarvis-text-muted font-mono">
                        {contact.last_seen_date}
                      </td>
                      <td className="py-2 text-right text-jarvis-text-muted font-mono">
                        {contact.event_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && data && data.summary.total === 0 && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-10 text-center">
            <p className="text-jarvis-text-muted text-sm mb-3">No contacts scanned yet</p>
            <p className="text-jarvis-text-dim text-xs">
              Click &quot;Backfill 4w&quot; to scan the past 4 weeks of calendar invites
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

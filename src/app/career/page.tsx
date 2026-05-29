'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/AppShell';

type Verdict = 'fit' | 'partial' | 'not_fit';
type JobStatus = 'new' | 'reviewing' | 'applied' | 'passed';

interface CareerJob {
  id: string;
  company: string;
  title: string;
  department: string | null;
  location: string | null;
  url: string;
  status: JobStatus;
  fit_verdict: Verdict | null;
  fit_score: number | null;
  role_summary: string | null;
  fit_rationale: string | null;
  first_seen: string;
  last_seen: string;
  closed_at: string | null;
}

interface SourceHealth {
  company: string;
  ok: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}

interface CareerData {
  jobs: CareerJob[];
  sources: SourceHealth[];
  lastRefreshedAt: string | null;
}

const STATUS_OPTIONS: JobStatus[] = ['new', 'reviewing', 'applied', 'passed'];

const VERDICT_ORDER: Record<string, number> = { fit: 0, partial: 1, not_fit: 2 };

function verdictStyle(v: Verdict | null): { bg: string; color: string; label: string } {
  switch (v) {
    case 'fit':
      return { bg: 'rgba(52, 199, 130, 0.14)', color: 'var(--color-jarvis-success)', label: 'Fit' };
    case 'partial':
      return { bg: 'rgba(230, 170, 60, 0.14)', color: 'var(--color-jarvis-warn)', label: 'Partial' };
    case 'not_fit':
      return { bg: 'var(--color-jarvis-bg-deep)', color: 'var(--color-jarvis-text-faint)', label: 'Not a fit' };
    default:
      return { bg: 'var(--color-jarvis-bg-deep)', color: 'var(--color-jarvis-text-faint)', label: 'Unscored' };
  }
}

function formatWibDate(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}-${String(wib.getUTCDate()).padStart(2, '0')}`;
}

export default function CareerPage() {
  const [data, setData] = useState<CareerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false); // false => fit + partial only
  const [showClosed, setShowClosed] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/career', { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/career/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      });
      await fetchJobs();
    } catch {
      /* silent */
    } finally {
      setRefreshing(false);
    }
  };

  const handleStatusChange = async (id: string, status: JobStatus) => {
    setData((prev) =>
      prev ? { ...prev, jobs: prev.jobs.map((j) => (j.id === id ? { ...j, status } : j)) } : prev,
    );
    try {
      await fetch('/api/career/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status }),
      });
    } catch {
      /* silent */
    }
  };

  const grouped = useMemo(() => {
    const jobs = (data?.jobs || []).filter((j) => {
      if (!showClosed && j.closed_at) return false;
      if (!showAll && (j.fit_verdict === 'not_fit' || j.fit_verdict === null)) return false;
      return true;
    });
    const byCompany = new Map<string, CareerJob[]>();
    for (const j of jobs) {
      if (!byCompany.has(j.company)) byCompany.set(j.company, []);
      byCompany.get(j.company)!.push(j);
    }
    for (const list of byCompany.values()) {
      list.sort((a, b) => {
        const va = VERDICT_ORDER[a.fit_verdict ?? ''] ?? 3;
        const vb = VERDICT_ORDER[b.fit_verdict ?? ''] ?? 3;
        if (va !== vb) return va - vb;
        return (b.fit_score ?? -1) - (a.fit_score ?? -1);
      });
    }
    return [...byCompany.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, showAll, showClosed]);

  const failedSources = (data?.sources || []).filter((s) => !s.ok);
  const totalShown = grouped.reduce((n, [, list]) => n + list.length, 0);

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
              Career
            </h1>
            <p className="text-[12px] text-jarvis-text-dim mt-0.5">
              In-region roles at Anthropic, Stripe, and Revolut, scored against your profile
            </p>
            {data?.lastRefreshedAt && (
              <p className="text-[11px] font-mono text-jarvis-text-faint mt-0.5">
                Last checked {formatWibDate(data.lastRefreshedAt)} WIB
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-1.5 text-[12px] rounded-[8px] text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-jarvis-cta)' }}
          >
            {refreshing ? 'Checking…' : 'Check now'}
          </button>
        </div>

        {/* Source-failure banner */}
        {failedSources.length > 0 && (
          <div
            className="rounded-[10px] p-3 text-[12px]"
            style={{
              background: 'rgba(230, 170, 60, 0.10)',
              border: '1px solid var(--color-jarvis-warn)',
              color: 'var(--color-jarvis-text-primary)',
            }}
          >
            {failedSources.map((s) => (
              <div key={s.company}>
                <span className="text-jarvis-warn font-medium">{s.company} source failed</span>
                {s.error ? <span className="text-jarvis-text-dim"> — {s.error}</span> : null}
              </div>
            ))}
          </div>
        )}

        {/* Toggles */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="px-3 py-1.5 text-[12px] rounded-full border transition-colors"
            style={{
              background: showAll ? 'var(--color-jarvis-cta-soft)' : 'transparent',
              borderColor: showAll ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-border)',
              color: showAll ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-text-dim)',
            }}
          >
            {showAll ? 'Showing all verdicts' : 'Fit + partial only'}
          </button>
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="px-3 py-1.5 text-[12px] rounded-full border transition-colors"
            style={{
              background: showClosed ? 'var(--color-jarvis-cta-soft)' : 'transparent',
              borderColor: showClosed ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-border)',
              color: showClosed ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-text-dim)',
            }}
          >
            {showClosed ? 'Showing closed' : 'Hide closed'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5 animate-pulse h-40"
              />
            ))}
          </div>
        )}

        {/* Groups */}
        {!loading &&
          grouped.map(([company, jobs]) => (
            <section key={company} className="space-y-3">
              <h2
                className="text-[14px] text-jarvis-text-secondary"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
              >
                {company}
                <span className="ml-2 text-[12px] text-jarvis-text-faint font-normal">{jobs.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onStatusChange={handleStatusChange} />
                ))}
              </div>
            </section>
          ))}

        {/* Empty */}
        {!loading && totalShown === 0 && (
          <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-10 text-center">
            <p className="text-[13px] text-jarvis-text-dim">
              {data && data.jobs.length > 0
                ? 'No roles match the current filters.'
                : 'No roles checked yet. Hit “Check now” to run the first scan.'}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function JobCard({
  job,
  onStatusChange,
}: {
  job: CareerJob;
  onStatusChange: (id: string, status: JobStatus) => void;
}) {
  const v = verdictStyle(job.fit_verdict);
  return (
    <div
      className="rounded-[14px] border bg-jarvis-bg-card p-5 flex flex-col gap-2.5"
      style={{ borderColor: 'var(--color-jarvis-border)', opacity: job.closed_at ? 0.55 : 1 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-[15px] font-medium text-jarvis-text-primary ${job.closed_at ? 'line-through' : ''}`}
          >
            {job.title}
          </p>
          <p className="text-[12px] text-jarvis-text-faint mt-0.5">
            {[job.location, job.department].filter(Boolean).join(' · ') || 'Location unknown'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {typeof job.fit_score === 'number' && (
            <span className="text-[12px] font-mono text-jarvis-text-dim">{job.fit_score}</span>
          )}
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
            style={{ background: v.bg, color: v.color }}
          >
            {v.label}
          </span>
        </div>
      </div>

      {job.role_summary && (
        <p className="text-[12.5px] text-jarvis-text-secondary leading-relaxed">{job.role_summary}</p>
      )}
      {job.fit_rationale && (
        <p className="text-[12px] italic leading-relaxed" style={{ color: 'var(--color-jarvis-text-dim)' }}>
          {job.fit_rationale}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 mt-1">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-jarvis-text-faint">
            {job.closed_at ? `closed ${formatWibDate(job.closed_at)}` : `seen ${formatWibDate(job.first_seen)}`}
          </span>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px]"
            style={{ color: 'var(--color-jarvis-cta)' }}
          >
            Apply →
          </a>
        </div>
        <select
          value={job.status}
          onChange={(e) => onStatusChange(job.id, e.target.value as JobStatus)}
          className="text-[11px] rounded-[6px] border border-jarvis-border bg-jarvis-bg-deep text-jarvis-text-dim px-1.5 py-1 focus:outline-none"
          aria-label="Status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

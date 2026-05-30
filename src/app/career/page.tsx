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
  count?: number;
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

// Sources with no reliable automated path (e.g. Revolut, behind Cloudflare).
// They stay wired so they auto-resume if a path opens, but their failures are
// expected and should not surface as a standing failure banner.
const BEST_EFFORT_SOURCES = ['Revolut'];

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

// Base city/country where the role sits (gate guarantees Singapore or Jakarta).
// A compound location can match both.
function baseRegions(location: string | null): string[] {
  const l = (location || '').toLowerCase();
  const out: string[] = [];
  if (l.includes('singapore')) out.push('Singapore');
  if (l.includes('jakarta') || l.includes('indonesia')) out.push('Jakarta');
  return out;
}

// Breadth of the role's mandate, inferred from the title.
type Scope = 'Global' | 'APAC' | 'SEA' | 'Country';
const SCOPE_ORDER: Scope[] = ['Global', 'APAC', 'SEA', 'Country'];
function coverageScope(title: string): Scope {
  const t = title.toLowerCase();
  if (/\bglobal\b|worldwide/.test(t)) return 'Global';
  if (/\bapac\b|asia[\s-]?pacific|\basia\b/.test(t)) return 'APAC';
  if (/\bsea\b|south[\s-]?east asia/.test(t)) return 'SEA';
  return 'Country';
}

// Normalized function category from department + title (cross-company taxonomy).
// Ordered most-specific first; first match wins. Tuned to Filman's relevant
// areas: strategy, GTM, product, architecture, general management / P&L.
function workType(department: string | null, title: string): string {
  const h = `${title} ${department || ''}`.toLowerCase();
  if (/policy|public affairs|government|regulat|global affairs/.test(h)) return 'Policy & Public Affairs';
  if (/general manager|country manager|managing director|business unit|\bp&l\b|chief executive|chief operating/.test(h))
    return 'General Management';
  if (/strateg|corp(orate)? dev|chief of staff|business operations|biz ?ops|\bplanning\b/.test(h)) return 'Strategy';
  if (/architect/.test(h)) return 'Architecture';
  if (/product manager|product lead|\bproduct\b/.test(h)) return 'Product';
  if (/sales|account (executive|director|manager)|business development|\bbd\b|go.?to.?market|\bgtm\b|revenue|partnership|client partner|commercial|deployment/.test(h))
    return 'GTM & Sales';
  if (/financ|treasury|controller|fp&a/.test(h)) return 'Finance';
  if (/enterprise risk|\brisk\b|compliance|controls\b/.test(h)) return 'Risk';
  if (/marketing|\bbrand\b|growth|demand gen|\bevents\b/.test(h)) return 'Marketing';
  if (/operations|\bops\b|supply chain|program manager|\bpmo\b|delivery|logistics/.test(h)) return 'Operations';
  if (/people|talent|recruit|human resources|\bhr\b|culture|employee/.test(h)) return 'People';
  if (/data scien|analytics|economist/.test(h)) return 'Data';
  return 'Other';
}

export default function CareerPage() {
  const [data, setData] = useState<CareerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false); // false => fit + partial only
  const [showClosed, setShowClosed] = useState(false);
  // Facet filters (empty set => no constraint).
  const [fCompany, setFCompany] = useState<Set<string>>(new Set());
  const [fBase, setFBase] = useState<Set<string>>(new Set());
  const [fScope, setFScope] = useState<Set<string>>(new Set());
  const [fWork, setFWork] = useState<Set<string>>(new Set());
  const [openFacet, setOpenFacet] = useState<string | null>(null);

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

  // Facet options + counts, computed over the closed-filtered set.
  const facets = useMemo(() => {
    const open = (data?.jobs || []).filter((j) => showClosed || !j.closed_at);
    const tally = (pick: (j: CareerJob) => string[]) => {
      const m = new Map<string, number>();
      for (const j of open) for (const v of pick(j)) m.set(v, (m.get(v) || 0) + 1);
      return m;
    };
    const sortAlpha = (m: Map<string, number>) =>
      [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
    const company = sortAlpha(tally((j) => [j.company]));
    const base = sortAlpha(tally((j) => baseRegions(j.location)));
    const scopeMap = tally((j) => [coverageScope(j.title)]);
    const scope = SCOPE_ORDER.filter((s) => scopeMap.has(s)).map((s) => ({ value: s, count: scopeMap.get(s)! }));
    const work = [...tally((j) => [workType(j.department, j.title)]).entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { company, base, scope, work };
  }, [data, showClosed]);

  const grouped = useMemo(() => {
    const jobs = (data?.jobs || []).filter((j) => {
      if (!showClosed && j.closed_at) return false;
      if (!showAll && (j.fit_verdict === 'not_fit' || j.fit_verdict === null)) return false;
      if (fCompany.size && !fCompany.has(j.company)) return false;
      if (fBase.size && !baseRegions(j.location).some((b) => fBase.has(b))) return false;
      if (fScope.size && !fScope.has(coverageScope(j.title))) return false;
      if (fWork.size && !fWork.has(workType(j.department, j.title))) return false;
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
  }, [data, showAll, showClosed, fCompany, fBase, fScope, fWork]);

  const failedSources = (data?.sources || []).filter(
    (s) => !s.ok && !BEST_EFFORT_SOURCES.includes(s.company),
  );
  const totalShown = grouped.reduce((n, [, list]) => n + list.length, 0);
  const anyFilter = fCompany.size + fBase.size + fScope.size + fWork.size > 0;
  const clearAllFilters = () => {
    setFCompany(new Set());
    setFBase(new Set());
    setFScope(new Set());
    setFWork(new Set());
    setOpenFacet(null);
  };
  const toggleIn = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string,
  ) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  return (
    <AppShell>
      {/* Backdrop to close any open facet menu on outside click. */}
      {openFacet && (
        <div className="fixed inset-0 z-30" onClick={() => setOpenFacet(null)} aria-hidden="true" />
      )}
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
              Singapore and Jakarta roles at Anthropic, OpenAI, Grab, GoTo, Stripe, and Revolut, scored against your profile
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

        {/* Source data-pull health */}
        {!loading && <SourceHealthStrip sources={data?.sources || []} />}

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

        {/* Facet filters */}
        <div className="relative z-40 flex gap-2 flex-wrap items-center">
          <FacetMenu
            label="Company"
            options={facets.company}
            selected={fCompany}
            onToggle={(v) => toggleIn(setFCompany, v)}
            onClear={() => setFCompany(new Set())}
            isOpen={openFacet === 'company'}
            onOpen={() => setOpenFacet(openFacet === 'company' ? null : 'company')}
          />
          <FacetMenu
            label="Base"
            options={facets.base}
            selected={fBase}
            onToggle={(v) => toggleIn(setFBase, v)}
            onClear={() => setFBase(new Set())}
            isOpen={openFacet === 'base'}
            onOpen={() => setOpenFacet(openFacet === 'base' ? null : 'base')}
          />
          <FacetMenu
            label="Scope"
            options={facets.scope}
            selected={fScope}
            onToggle={(v) => toggleIn(setFScope, v)}
            onClear={() => setFScope(new Set())}
            isOpen={openFacet === 'scope'}
            onOpen={() => setOpenFacet(openFacet === 'scope' ? null : 'scope')}
          />
          <FacetMenu
            label="Type of work"
            options={facets.work}
            selected={fWork}
            onToggle={(v) => toggleIn(setFWork, v)}
            onClear={() => setFWork(new Set())}
            isOpen={openFacet === 'work'}
            onOpen={() => setOpenFacet(openFacet === 'work' ? null : 'work')}
          />
          {anyFilter && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1.5 text-[12px] rounded-full text-jarvis-text-faint hover:text-jarvis-text-dim"
            >
              Clear filters
            </button>
          )}
        </div>

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

// At-a-glance data-pull health for each source. Green = fetched OK (with the
// raw count pulled), amber = best-effort source that is expected to fail
// (Revolut, Cloudflare-blocked), red = a genuine failure that needs attention.
function SourceHealthStrip({ sources }: { sources: SourceHealth[] }) {
  if (!sources.length) return null;
  const ordered = [...sources].sort((a, b) => a.company.localeCompare(b.company));
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      <span
        className="text-[10px] uppercase text-jarvis-text-faint"
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}
      >
        Sources
      </span>
      {ordered.map((s) => {
        const bestEffort = BEST_EFFORT_SOURCES.includes(s.company);
        const color = s.ok
          ? 'var(--color-jarvis-success)'
          : bestEffort
            ? 'var(--color-jarvis-warn)'
            : 'var(--color-jarvis-danger)';
        const detail = s.ok ? `${s.count ?? 0}` : bestEffort ? 'blocked' : 'failed';
        const title = s.error
          ? s.error
          : s.lastSyncedAt
            ? `pulled ${s.count ?? 0} · last checked ${formatWibDate(s.lastSyncedAt)} WIB`
            : '';
        return (
          <span key={s.company} className="inline-flex items-center gap-1.5 text-[12px]" title={title}>
            <span className="inline-block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
            <span className="text-jarvis-text-secondary">{s.company}</span>
            <span className="font-mono text-[11px] text-jarvis-text-faint">{detail}</span>
          </span>
        );
      })}
    </div>
  );
}

function FacetMenu({
  label,
  options,
  selected,
  onToggle,
  onClear,
  isOpen,
  onOpen,
}: {
  label: string;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const active = selected.size > 0;
  return (
    <div className="relative">
      <button
        onClick={onOpen}
        className="px-3 py-1.5 text-[12px] rounded-full border transition-colors flex items-center gap-1.5"
        style={{
          background: active ? 'var(--color-jarvis-cta-soft)' : 'transparent',
          borderColor: active ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-border)',
          color: active ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-text-dim)',
        }}
      >
        {label}
        {active ? ` · ${selected.size}` : ''}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[210px] max-h-[320px] overflow-auto rounded-[10px] border border-jarvis-border bg-jarvis-bg-card p-1.5 shadow-lg">
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-[12px] text-jarvis-text-faint">No options</div>
          )}
          {options.map((o) => {
            const on = selected.has(o.value);
            return (
              <button
                key={o.value}
                onClick={() => onToggle(o.value)}
                className="w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-[12.5px] hover:bg-jarvis-bg-deep text-left"
                style={{ color: on ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-text-dim)' }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: on ? 'var(--color-jarvis-cta)' : 'var(--color-jarvis-border)',
                      background: on ? 'var(--color-jarvis-cta)' : 'transparent',
                    }}
                  >
                    {on && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  {o.value}
                </span>
                <span className="text-[11px] text-jarvis-text-faint">{o.count}</span>
              </button>
            );
          })}
          {active && (
            <button
              onClick={onClear}
              className="w-full mt-1 px-2 py-1.5 text-[11px] text-jarvis-text-faint hover:text-jarvis-text-dim text-left border-t border-jarvis-border"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
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

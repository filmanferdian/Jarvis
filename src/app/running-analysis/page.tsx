'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';

interface AnalysisStatus {
  lastRun: string | null;
  lastResult: string | null;
  lastError: string | null;
  recordsSynced: number;
}

interface TriggerResult {
  weekStart: string;
  weekEnd: string;
  activitiesFound: number;
  activitiesIngested: number;
  activitiesSkipped: number;
  analysisGenerated: boolean;
  weeklyInsightUpdated: boolean;
  dashboardUpdated: boolean;
  errors: string[];
  timestamp: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-jarvis-text-dim">—</span>;
  const colors: Record<string, string> = {
    success: 'text-jarvis-success',
    error: 'text-jarvis-danger',
    skipped: 'text-jarvis-warn',
  };
  return (
    <span className={`font-mono text-[12px] ${colors[status] ?? 'text-jarvis-text-muted'}`}>
      {status}
    </span>
  );
}

export default function RunningAnalysisPage() {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [dateOverride, setDateOverride] = useState('');
  const [analysisOnly, setAnalysisOnly] = useState(false);
  const [forceResync, setForceResync] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchAuth<AnalysisStatus>('/api/running-analysis');
      setStatus(data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleTrigger() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const body: Record<string, unknown> = {};
      if (dateOverride) body.date = dateOverride;
      if (analysisOnly) body.analysis_only = true;
      if (forceResync) body.force_resync = true;

      const res = await fetch('/api/running-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Unknown error');
      } else {
        setResult(data as TriggerResult);
        await loadStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-jarvis-text-muted">
          <a href="/" className="hover:text-jarvis-accent transition-colors">Dashboard</a>
          <span>/</span>
          <span className="text-jarvis-text-primary">Running Analysis</span>
        </div>

        {/* Header */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
          <h1 className="text-[17px] font-semibold text-jarvis-text-primary mb-1">Running Analysis</h1>
          <p className="text-[13px] text-jarvis-text-muted">
            Automatic weekly analysis of outdoor running data. Runs every Monday at 6am WIB,
            analyzing the previous Mon–Sun week. Ingests from Garmin → Notion Runs DB →
            Weekly Insights DB → Dashboard.
          </p>
        </div>

        {/* Last Run Status */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-3">
          <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
            Last Run
          </h2>
          {loading ? (
            <div className="h-4 w-48 bg-jarvis-border rounded animate-pulse" />
          ) : (
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <p className="text-jarvis-text-dim mb-0.5">When</p>
                <p className="text-jarvis-text-secondary">{formatDate(status?.lastRun ?? null)}</p>
              </div>
              <div>
                <p className="text-jarvis-text-dim mb-0.5">Result</p>
                <StatusBadge status={status?.lastResult ?? null} />
              </div>
              <div>
                <p className="text-jarvis-text-dim mb-0.5">Activities ingested</p>
                <p className="font-mono text-jarvis-text-secondary">{status?.recordsSynced ?? 0}</p>
              </div>
              {status?.lastError && (
                <div className="col-span-2">
                  <p className="text-jarvis-text-dim mb-0.5">Last error</p>
                  <p className="text-jarvis-danger text-[12px] font-mono break-all">{status.lastError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Trigger */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-4">
          <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
            Manual Trigger
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-[12px] text-jarvis-text-muted mb-1">
                Week date override <span className="text-jarvis-text-dim">(YYYY-MM-DD, optional)</span>
              </label>
              <input
                type="date"
                value={dateOverride}
                onChange={(e) => setDateOverride(e.target.value)}
                className="bg-jarvis-bg border border-jarvis-border rounded-lg px-3 py-1.5 text-[13px] text-jarvis-text-primary focus:outline-none focus:border-jarvis-accent w-48"
                placeholder="defaults to previous week"
              />
              <p className="text-[11px] text-jarvis-text-dim mt-1">
                Analyzes the Mon–Sun week containing this date. Leave empty for previous week.
              </p>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-[13px] text-jarvis-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={analysisOnly}
                  onChange={(e) => setAnalysisOnly(e.target.checked)}
                  className="accent-jarvis-accent"
                />
                Analysis only <span className="text-jarvis-text-dim">(skip Notion ingestion)</span>
              </label>
              <label className="flex items-center gap-2 text-[13px] text-jarvis-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceResync}
                  onChange={(e) => setForceResync(e.target.checked)}
                  className="accent-jarvis-accent"
                />
                Force re-sync <span className="text-jarvis-text-dim">(overwrite existing)</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleTrigger}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-jarvis-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running analysis...
              </>
            ) : (
              'Run Analysis'
            )}
          </button>

          {running && (
            <p className="text-[12px] text-jarvis-text-dim">
              This may take 1–2 minutes — Garmin API calls are rate-limited with 1.5s delays.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-jarvis-danger bg-jarvis-bg-card p-4">
            <p className="text-jarvis-danger text-[13px] font-mono">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
                Result
              </h2>
              <span className="text-[11px] text-jarvis-text-dim">{formatDate(result.timestamp)}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Week', value: `${result.weekStart} → ${result.weekEnd}` },
                { label: 'Activities found', value: String(result.activitiesFound) },
                { label: 'Ingested', value: String(result.activitiesIngested) },
                { label: 'Skipped (dup)', value: String(result.activitiesSkipped) },
                { label: 'Analysis', value: result.analysisGenerated ? 'Generated' : 'Skipped' },
                { label: 'Weekly Insights', value: result.weeklyInsightUpdated ? 'Updated' : 'Failed' },
                { label: 'Dashboard', value: result.dashboardUpdated ? 'Updated' : 'Skipped' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[11px] text-jarvis-text-dim mb-0.5">{label}</p>
                  <p className="text-[13px] text-jarvis-text-secondary font-mono">{value}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="text-[12px] text-jarvis-warn mb-1">Partial errors:</p>
                <ul className="space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-[12px] text-jarvis-text-muted font-mono">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
          <h3 className="text-[12px] font-medium text-jarvis-text-dim uppercase tracking-wider mb-2">
            Pipeline
          </h3>
          <ol className="space-y-1 text-[12px] text-jarvis-text-muted list-decimal list-inside">
            <li>Query Supabase for outdoor runs in the Mon–Sun week</li>
            <li>Redundancy check — skip Garmin IDs already in Notion Runs DB</li>
            <li>Enrich each new run: Garmin API → splits, weather, perf condition, decoupling</li>
            <li>Write to Notion Runs DB (page + all 27+ properties)</li>
            <li>Generate weekly analysis via Claude (4 sections)</li>
            <li>Upsert to Weekly Insights Notion DB (auto-created on first run)</li>
            <li>Update Running Log dashboard subtitle + analysis section</li>
          </ol>
        </div>
      </div>
    </AppShell>
  );
}

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

interface WeeklyInsightEntry {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  runsLogged: number;
  totalDistanceKm: number;
  totalDurationMins: number;
  avgPacePerKm: string;
  avgHr: number | null;
  totalTrainingLoad: number;
  howWasThisWeek: string;
  whatsGood: string;
  whatNeedsWork: string;
  focusNextWeek: string;
  generatedAt: string;
}

interface RunSummary {
  date: string;
  name: string;
  distanceKm: number;
  durationFormatted: string;
  avgPacePerKm: string;
  avgHr: number | null;
  trainingLoad: number | null;
  tempC: number | null;
  weather: string | null;
}

interface InsightsResponse {
  insights: WeeklyInsightEntry[];
  recentRuns: RunSummary[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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

function AnalysisSection({ label, text }: { label: string; text: string }) {
  if (!text || text === 'N/A') return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-jarvis-text-dim uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[13px] text-jarvis-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}

export default function RunningAnalysisPage() {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [insights, setInsights] = useState<WeeklyInsightEntry[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  // Trigger form state
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setStatusLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    try {
      const data = await fetchAuth<InsightsResponse>('/api/running-analysis/insights');
      setInsights(data.insights);
      setRecentRuns(data.recentRuns);
      if (data.insights.length > 0) {
        setExpandedWeek(data.insights[0].weekStart);
      }
    } catch {
      // Silent fail
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadInsights();
  }, [loadStatus, loadInsights]);

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
        await Promise.all([loadStatus(), loadInsights()]);
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
            Weekly AI analysis of outdoor running data. Auto-runs every Saturday at 12pm WIB,
            analyzing Mon–Sat of the current week. Pipeline: Garmin → Notion Runs DB → Claude → Weekly Insights.
          </p>
        </div>

        {/* Weekly Insights */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
              Weekly Insights
            </h2>
            {!insightsLoading && insights.length > 0 && (
              <span className="text-[12px] text-jarvis-text-dim font-mono">{insights.length} weeks</span>
            )}
          </div>

          {insightsLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-jarvis-border p-4 space-y-2 animate-pulse">
                  <div className="h-4 w-48 bg-jarvis-border rounded" />
                  <div className="h-3 w-72 bg-jarvis-border rounded" />
                </div>
              ))}
            </div>
          ) : insights.length === 0 ? (
            <p className="text-[13px] text-jarvis-text-dim py-2">
              No weekly insights yet — run the analysis to generate the first one.
            </p>
          ) : (
            <div className="space-y-2">
              {insights.map((insight) => {
                const isExpanded = expandedWeek === insight.weekStart;
                return (
                  <div
                    key={insight.weekStart}
                    className="rounded-lg border border-jarvis-border overflow-hidden"
                  >
                    {/* Header row — always visible */}
                    <button
                      onClick={() => setExpandedWeek(isExpanded ? null : insight.weekStart)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-jarvis-border/20 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-jarvis-text-primary">{insight.weekLabel}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          <span className="text-[12px] text-jarvis-text-muted font-mono">
                            {insight.runsLogged} run{insight.runsLogged !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[12px] text-jarvis-text-muted font-mono">
                            {insight.totalDistanceKm} km
                          </span>
                          {insight.avgPacePerKm && insight.avgPacePerKm !== '--:--' && (
                            <span className="text-[12px] text-jarvis-text-muted font-mono">
                              {insight.avgPacePerKm}/km avg
                            </span>
                          )}
                          {insight.avgHr && (
                            <span className="text-[12px] text-jarvis-text-muted font-mono">
                              {insight.avgHr} bpm avg HR
                            </span>
                          )}
                          {insight.totalDurationMins > 0 && (
                            <span className="text-[12px] text-jarvis-text-muted font-mono">
                              {formatDuration(insight.totalDurationMins)}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-jarvis-text-dim flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded analysis sections */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-jarvis-border space-y-4">
                        <AnalysisSection label="How was this week" text={insight.howWasThisWeek} />
                        <AnalysisSection label="What's good" text={insight.whatsGood} />
                        <AnalysisSection label="What needs work" text={insight.whatNeedsWork} />
                        <AnalysisSection label="Focus next week" text={insight.focusNextWeek} />
                        {insight.generatedAt && (
                          <p className="text-[11px] text-jarvis-text-dim pt-1 border-t border-jarvis-border">
                            Generated {formatShortDate(insight.generatedAt)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All Runs */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
              All Runs
            </h2>
            {!insightsLoading && recentRuns.length > 0 && (
              <span className="text-[12px] text-jarvis-text-dim font-mono">{recentRuns.length} total</span>
            )}
          </div>

          {insightsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 bg-jarvis-border rounded animate-pulse" />
              ))}
            </div>
          ) : recentRuns.length === 0 ? (
            <p className="text-[13px] text-jarvis-text-dim py-2">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-jarvis-text-dim border-b border-jarvis-border">
                    <th className="text-left pb-2 pr-4 font-medium">Date</th>
                    <th className="text-right pb-2 pr-4 font-medium">Dist</th>
                    <th className="text-right pb-2 pr-4 font-medium">Pace</th>
                    <th className="text-right pb-2 pr-4 font-medium">Avg HR</th>
                    <th className="text-right pb-2 pr-4 font-medium">Load</th>
                    <th className="text-left pb-2 font-medium">Weather</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jarvis-border/50">
                  {recentRuns.map((run, i) => (
                    <tr key={i} className="text-jarvis-text-secondary">
                      <td className="py-2 pr-4">{formatShortDate(run.date)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.distanceKm}km</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.avgPacePerKm || '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.avgHr ?? '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.trainingLoad ?? '—'}</td>
                      <td className="py-2 text-jarvis-text-muted">
                        {run.weather
                          ? `${run.weather}${run.tempC != null ? `, ${run.tempC}°C` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Last Run Status */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 space-y-3">
          <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
            Last Pipeline Run
          </h2>
          {statusLoading ? (
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
              />
              <p className="text-[11px] text-jarvis-text-dim mt-1">
                Analyzes Mon–today of the week containing this date. Leave empty for current week.
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
      </div>
    </AppShell>
  );
}

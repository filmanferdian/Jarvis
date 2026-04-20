'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis,
} from 'recharts';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';
import HRZoneCalculator from '@/components/HRZoneCalculator';
import Mindmap from '@/components/Mindmap';

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
  avgCadenceSpm: number | null;
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
  durationMins?: number;
  avgPacePerKm: string;
  avgHr: number | null;
  cadenceSpm: number | null;
  trainingLoad: number | null;
  tempC: number | null;
  weather: string | null;
}

interface InsightsResponse {
  insights: WeeklyInsightEntry[];
  recentRuns: RunSummary[];
}

interface TrendPoint {
  date: string;
  value: number;
}

interface TrendResponse {
  data: TrendPoint[];
}

// Zone classification by avgHr (fallback when no per-run zone split is available).
// Boundaries align with typical LTHR ~165 → Z2 ceiling ~150.
const ZONES = [
  { key: 'z1', label: 'Z1', short: 'Recovery', hrMax: 125, color: 'rgba(74,93,207,0.3)' },
  { key: 'z2', label: 'Z2', short: 'Base', hrMax: 150, color: 'var(--color-jarvis-ambient)' },
  { key: 'z3', label: 'Z3', short: 'Tempo', hrMax: 165, color: '#6f7fd9' },
  { key: 'z4', label: 'Z4', short: 'Threshold', hrMax: 180, color: 'var(--color-jarvis-warn)' },
  { key: 'z5', label: 'Z5', short: 'VO2', hrMax: 999, color: 'var(--color-jarvis-danger)' },
] as const;

function classifyZone(avgHr: number | null): number {
  if (avgHr == null) return -1;
  for (let i = 0; i < ZONES.length; i++) {
    if (avgHr <= ZONES[i].hrMax) return i;
  }
  return ZONES.length - 1;
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

function parseDurationMins(formatted: string): number {
  const hMatch = formatted.match(/(\d+)h/);
  const mMatch = formatted.match(/(\d+)m/);
  return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-jarvis-text-faint">—</span>;
  const colors: Record<string, string> = {
    success: 'var(--color-jarvis-good)',
    error: 'var(--color-jarvis-danger)',
    skipped: 'var(--color-jarvis-warn)',
  };
  return (
    <span
      className="font-mono text-[12px]"
      style={{ color: colors[status] ?? 'var(--color-jarvis-text-dim)' }}
    >
      {status}
    </span>
  );
}

function AnalysisSection({ label, text }: { label: string; text: string }) {
  if (!text || text === 'N/A') return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-jarvis-text-faint uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[13px] text-jarvis-text-dim leading-relaxed">{text}</p>
    </div>
  );
}

function buildVerdict(runs: RunSummary[], hrvTrend: TrendPoint[]): { title: string; body: string } {
  if (runs.length === 0) {
    return {
      title: 'No cardio data yet',
      body: 'Run the weekly analysis or sync Garmin activities to see a verdict.',
    };
  }

  const lastWeek = runs.slice(0, 10);
  const totalKm = lastWeek.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalLoad = lastWeek.reduce((s, r) => s + (r.trainingLoad || 0), 0);

  let z1 = 0, z2 = 0, z3plus = 0;
  for (const r of lastWeek) {
    const z = classifyZone(r.avgHr);
    const mins = r.durationMins ?? parseDurationMins(r.durationFormatted);
    if (z === 0) z1 += mins;
    else if (z === 1) z2 += mins;
    else if (z >= 2) z3plus += mins;
  }
  const total = z1 + z2 + z3plus;
  const z2Share = total > 0 ? z2 / total : 0;

  const recentHrv = hrvTrend.slice(-7);
  const olderHrv = hrvTrend.slice(-14, -7);
  const recentAvg = recentHrv.length > 0 ? recentHrv.reduce((s, p) => s + p.value, 0) / recentHrv.length : null;
  const olderAvg = olderHrv.length > 0 ? olderHrv.reduce((s, p) => s + p.value, 0) / olderHrv.length : null;
  const hrvDir = recentAvg && olderAvg ? (recentAvg > olderAvg + 1 ? 'up' : recentAvg < olderAvg - 1 ? 'down' : 'flat') : null;

  const title =
    z2Share >= 0.7 ? 'Clean aerobic base week'
    : z2Share >= 0.5 ? 'Balanced distribution'
    : z2Share > 0 ? 'Intensity-heavy mix'
    : 'No HR data on recent runs';

  const body =
    `${totalKm.toFixed(1)} km across ${lastWeek.length} run${lastWeek.length === 1 ? '' : 's'}, ` +
    `training load ${Math.round(totalLoad)}. ` +
    (total > 0 ? `Zone 2 held ${Math.round(z2Share * 100)}% of the time. ` : '') +
    (hrvDir === 'up' ? 'HRV trending up — recovery is catching up to the load.'
      : hrvDir === 'down' ? 'HRV trending down — back off or recover harder next cycle.'
      : hrvDir === 'flat' ? 'HRV flat — absorbing the load.'
      : 'HRV data unavailable for the trend read.');

  return { title, body };
}

export default function CardioAnalysisPage() {
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [insights, setInsights] = useState<WeeklyInsightEntry[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [hrvTrend, setHrvTrend] = useState<TrendPoint[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error('[running-analysis] Failed to load insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadHrv = useCallback(async () => {
    try {
      const data = await fetchAuth<TrendResponse>('/api/health-fitness/trends?metric=hrv_7d_avg&days=56');
      setHrvTrend(data.data || []);
    } catch {
      // HRV trend is optional
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadInsights();
    loadHrv();
  }, [loadStatus, loadInsights, loadHrv]);

  const zoneDistribution = useMemo(() => {
    const mins = Array(ZONES.length).fill(0);
    for (const r of recentRuns) {
      const z = classifyZone(r.avgHr);
      if (z < 0) continue;
      const runMins = r.durationMins ?? parseDurationMins(r.durationFormatted);
      mins[z] += runMins;
    }
    const total = mins.reduce((a, b) => a + b, 0);
    return ZONES.map((z, i) => ({
      ...z,
      mins: mins[i],
      pct: total > 0 ? mins[i] / total : 0,
    }));
  }, [recentRuns]);

  const scatterData = useMemo(() => {
    const hrvByDate = new Map(hrvTrend.map((p) => [p.date, p.value]));
    return recentRuns
      .map((r) => {
        const hrv = hrvByDate.get(r.date);
        if (hrv == null || r.trainingLoad == null) return null;
        return {
          date: r.date,
          hrv,
          load: r.trainingLoad,
          distance: r.distanceKm,
        };
      })
      .filter((x): x is { date: string; hrv: number; load: number; distance: number } => x !== null);
  }, [recentRuns, hrvTrend]);

  const verdict = useMemo(() => buildVerdict(recentRuns, hrvTrend), [recentRuns, hrvTrend]);

  async function handleTrigger() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/running-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Unknown error');
      } else {
        setResult(data as TriggerResult);
        await Promise.all([loadStatus(), loadInsights(), loadHrv()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-jarvis-text-dim">
          <a href="/" className="hover:text-jarvis-cta transition-colors">Dashboard</a>
          <span>/</span>
          <span className="text-jarvis-text-primary">Cardio Analysis</span>
        </div>

        {/* Jarvis verdict */}
        <div
          className="rounded-[14px] border p-6 flex gap-5 items-start"
          style={{
            background: 'linear-gradient(135deg, var(--color-jarvis-bg-elevated), var(--color-jarvis-bg-card))',
            borderColor: 'var(--color-jarvis-ambient-soft)',
          }}
        >
          <div
            className="w-14 h-14 rounded-[14px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-jarvis-ambient-soft)' }}
          >
            <Mindmap size={48} state="speaking" density="sparse" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-display)] text-[18px] font-medium tracking-tight text-jarvis-text-primary mb-2">
              {verdict.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-jarvis-text-dim m-0 max-w-[720px]">
              {verdict.body}
            </p>
          </div>
        </div>

        {/* Cardio grid: zones + scatter */}
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-5">
          {/* Zones */}
          <div
            className="rounded-[14px] border p-5"
            style={{
              background: 'var(--color-jarvis-bg-card)',
              borderColor: 'var(--color-jarvis-border)',
            }}
          >
            <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider mb-1">
              Zone distribution
            </h2>
            <p className="text-[12px] text-jarvis-text-faint mb-4">
              Time-in-zone across the last {recentRuns.length} run{recentRuns.length === 1 ? '' : 's'} (classified by avg HR).
            </p>
            <div className="flex flex-col gap-2.5 mt-2.5">
              {zoneDistribution.map((z) => (
                <div
                  key={z.key}
                  className="grid items-center gap-2 sm:gap-3 text-[12.5px] grid-cols-[auto_1fr_auto]"
                >
                  <span className="font-mono text-[10.5px] text-jarvis-text-dim">
                    {z.label} · {z.short}
                  </span>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--color-jarvis-track)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(z.pct * 100, z.mins > 0 ? 2 : 0)}%`,
                        background: z.color,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-right text-jarvis-text-dim">
                    {z.mins > 0 ? `${formatDuration(z.mins)} · ${Math.round(z.pct * 100)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* HRV vs Load scatter */}
          <div
            className="rounded-[14px] border p-5"
            style={{
              background: 'var(--color-jarvis-bg-card)',
              borderColor: 'var(--color-jarvis-border)',
            }}
          >
            <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider mb-1">
              HRV vs training load
            </h2>
            <p className="text-[12px] text-jarvis-text-faint mb-4">
              Each dot is a run day — watch for HRV dropping as load climbs.
            </p>
            {scatterData.length > 0 ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 24, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(12,15,36,0.08)" />
                    <XAxis
                      type="number"
                      dataKey="load"
                      name="Load"
                      tick={{ fill: 'rgba(12,15,36,0.38)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(12,15,36,0.08)' }}
                      tickLine={false}
                      label={{ value: 'Training load', position: 'insideBottom', offset: -12, fill: 'rgba(12,15,36,0.64)', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="hrv"
                      name="HRV"
                      tick={{ fill: 'rgba(12,15,36,0.38)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(12,15,36,0.08)' }}
                      tickLine={false}
                      label={{ value: 'HRV (7d)', angle: -90, position: 'insideLeft', fill: 'rgba(12,15,36,0.64)', fontSize: 11 }}
                    />
                    <ZAxis type="number" dataKey="distance" range={[40, 180]} name="Distance" />
                    <Tooltip
                      cursor={{ strokeDasharray: '2 4' }}
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid rgba(12,15,36,0.08)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value, name) => {
                        const v = typeof value === 'number' ? value.toFixed(1) : String(value ?? '');
                        return [v, String(name ?? '')];
                      }}
                      labelFormatter={(_, payload) => {
                        const d = payload?.[0]?.payload as { date?: string } | undefined;
                        return d?.date ? formatShortDate(d.date) : '';
                      }}
                    />
                    <Scatter data={scatterData} fill="#4a5dcf" fillOpacity={0.75} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-[12px] text-jarvis-text-faint py-8 text-center">
                No matched HRV + training-load days yet.
              </p>
            )}
          </div>
        </div>

        {/* HR Zone Calculator */}
        <HRZoneCalculator />

        {/* Weekly Insights */}
        <div
          className="rounded-[14px] border p-5 space-y-3"
          style={{
            background: 'var(--color-jarvis-bg-card)',
            borderColor: 'var(--color-jarvis-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
              Weekly Insights
            </h2>
            {!insightsLoading && insights.length > 0 && (
              <span className="text-[12px] text-jarvis-text-faint font-mono">{insights.length} weeks</span>
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
            <p className="text-[13px] text-jarvis-text-faint py-2">
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
                    <button
                      onClick={() => setExpandedWeek(isExpanded ? null : insight.weekStart)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-jarvis-bg-elevated transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-jarvis-text-primary">{insight.weekLabel}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          <span className="text-[12px] text-jarvis-text-dim font-mono">
                            {insight.runsLogged} run{insight.runsLogged !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[12px] text-jarvis-text-dim font-mono">
                            {insight.totalDistanceKm} km
                          </span>
                          {insight.avgPacePerKm && insight.avgPacePerKm !== '--:--' && (
                            <span className="text-[12px] text-jarvis-text-dim font-mono">
                              {insight.avgPacePerKm}/km avg
                            </span>
                          )}
                          {insight.avgHr && (
                            <span className="text-[12px] text-jarvis-text-dim font-mono">
                              {insight.avgHr} bpm avg HR
                            </span>
                          )}
                          {insight.avgCadenceSpm && (
                            <span className="text-[12px] text-jarvis-text-dim font-mono">
                              {insight.avgCadenceSpm} spm avg cadence
                            </span>
                          )}
                          {insight.totalDurationMins > 0 && (
                            <span className="text-[12px] text-jarvis-text-dim font-mono">
                              {formatDuration(insight.totalDurationMins)}
                            </span>
                          )}
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-jarvis-text-faint flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-jarvis-border space-y-4">
                        <AnalysisSection label="How was this week" text={insight.howWasThisWeek} />
                        <AnalysisSection label="What's good" text={insight.whatsGood} />
                        <AnalysisSection label="What needs work" text={insight.whatNeedsWork} />
                        <AnalysisSection label="Focus next week" text={insight.focusNextWeek} />
                        {insight.generatedAt && (
                          <p className="text-[11px] text-jarvis-text-faint pt-1 border-t border-jarvis-border">
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
        <div
          className="rounded-[14px] border p-5 space-y-3"
          style={{
            background: 'var(--color-jarvis-bg-card)',
            borderColor: 'var(--color-jarvis-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
              All Runs
            </h2>
            {!insightsLoading && recentRuns.length > 0 && (
              <span className="text-[12px] text-jarvis-text-faint font-mono">{recentRuns.length} total</span>
            )}
          </div>

          {insightsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 bg-jarvis-border rounded animate-pulse" />
              ))}
            </div>
          ) : recentRuns.length === 0 ? (
            <p className="text-[13px] text-jarvis-text-faint py-2">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-jarvis-text-faint border-b border-jarvis-border">
                    <th className="text-left pb-2 pr-4 font-medium">Date</th>
                    <th className="text-right pb-2 pr-4 font-medium">Dist</th>
                    <th className="text-right pb-2 pr-4 font-medium">Pace</th>
                    <th className="text-right pb-2 pr-4 font-medium">Avg HR</th>
                    <th className="text-right pb-2 pr-4 font-medium">Cadence</th>
                    <th className="text-right pb-2 pr-4 font-medium">Load</th>
                    <th className="text-left pb-2 font-medium">Weather</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jarvis-border">
                  {recentRuns.map((run, i) => (
                    <tr key={i} className="text-jarvis-text-dim">
                      <td className="py-2 pr-4">{formatShortDate(run.date)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.distanceKm}km</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.avgPacePerKm || '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.avgHr ?? '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.cadenceSpm ?? '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono">{run.trainingLoad ?? '—'}</td>
                      <td className="py-2 text-jarvis-text-dim">
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
        <div
          className="rounded-[14px] border p-5 space-y-3"
          style={{
            background: 'var(--color-jarvis-bg-card)',
            borderColor: 'var(--color-jarvis-border)',
          }}
        >
          <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
            Last Pipeline Run
          </h2>
          {statusLoading ? (
            <div className="h-4 w-48 bg-jarvis-border rounded animate-pulse" />
          ) : (
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <p className="text-jarvis-text-faint mb-0.5">When</p>
                <p className="text-jarvis-text-dim">{formatDate(status?.lastRun ?? null)}</p>
              </div>
              <div>
                <p className="text-jarvis-text-faint mb-0.5">Result</p>
                <StatusBadge status={status?.lastResult ?? null} />
              </div>
              <div>
                <p className="text-jarvis-text-faint mb-0.5">Activities ingested</p>
                <p className="font-mono text-jarvis-text-dim">{status?.recordsSynced ?? 0}</p>
              </div>
              {status?.lastError && (
                <div className="col-span-2">
                  <p className="text-jarvis-text-faint mb-0.5">Last error</p>
                  <p className="text-[12px] font-mono break-all" style={{ color: 'var(--color-jarvis-danger)' }}>
                    {status.lastError}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Trigger */}
        <div
          className="rounded-[14px] border p-5 flex items-center justify-between gap-4"
          style={{
            background: 'var(--color-jarvis-bg-card)',
            borderColor: 'var(--color-jarvis-border)',
          }}
        >
          <div>
            <p className="text-[13px] text-jarvis-text-primary font-medium mb-0.5">Run this week's analysis</p>
            <p className="text-[12px] text-jarvis-text-faint">
              Pulls Mon – today, ingests new runs, generates Claude analysis.
              {running && ' This may take 1–2 minutes…'}
            </p>
          </div>
          <button
            onClick={handleTrigger}
            disabled={running}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-jarvis-cta)' }}
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running…
              </>
            ) : (
              'Run Analysis'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-[14px] border p-4"
            style={{
              background: 'var(--color-jarvis-bg-card)',
              borderColor: 'var(--color-jarvis-danger)',
            }}
          >
            <p className="text-[13px] font-mono" style={{ color: 'var(--color-jarvis-danger)' }}>{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className="rounded-[14px] border p-5 space-y-4"
            style={{
              background: 'var(--color-jarvis-bg-card)',
              borderColor: 'var(--color-jarvis-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-jarvis-text-primary uppercase tracking-wider">
                Result
              </h2>
              <span className="text-[11px] text-jarvis-text-faint">{formatDate(result.timestamp)}</span>
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
                  <p className="text-[11px] text-jarvis-text-faint mb-0.5">{label}</p>
                  <p className="text-[13px] text-jarvis-text-dim font-mono">{value}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="text-[12px] mb-1" style={{ color: 'var(--color-jarvis-warn)' }}>Partial errors:</p>
                <ul className="space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-[12px] text-jarvis-text-dim font-mono">{e}</li>
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

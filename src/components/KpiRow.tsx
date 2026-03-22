'use client';

import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';

interface Kpi {
  id: string;
  domainName: string;
  name: string;
  value: number;
  target: number | null;
  unit: string | null;
  trend: 'up' | 'down' | 'flat' | null;
  progress: number | null;
  qualifier: string | null;
  lastUpdated: string | null;
}

interface KpisData {
  kpis: Kpi[];
}

const TREND_ICONS: Record<string, { symbol: string; color: string; label: string }> = {
  up: { symbol: '\u2191', color: 'text-emerald-400', label: 'Trending up' },
  down: { symbol: '\u2193', color: 'text-red-400', label: 'Trending down' },
  flat: { symbol: '\u2192', color: 'text-jarvis-text-dim', label: 'Holding steady' },
};

function deriveMeaning(kpi: Kpi): string {
  if (kpi.progress !== null) {
    if (kpi.progress >= 90) return 'On track';
    if (kpi.progress >= 70) return 'Good progress';
    if (kpi.progress >= 50) return 'Needs attention';
    return 'Behind target';
  }
  if (kpi.trend) return TREND_ICONS[kpi.trend].label;
  return '';
}

function qualifierColor(q: string): string {
  const upper = q.toUpperCase();
  const green = ['EXCELLENT', 'GOOD', 'SUPERIOR', 'BALANCED', 'PRODUCTIVE', 'CHARGED', 'ATHLETIC', 'RELAXED', 'REST', 'LOW'];
  const orange = ['FAIR', 'MODERATE', 'MAINTAINING', 'UNBALANCED', 'NORMAL', 'MEDIUM'];
  const red = ['POOR', 'DETRAINING', 'DRAINED', 'ELEVATED', 'HIGH'];
  if (green.includes(upper)) return 'text-emerald-400';
  if (orange.includes(upper)) return 'text-jarvis-warn';
  if (red.includes(upper)) return 'text-red-400';
  return 'text-jarvis-text-dim';
}

function toSentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Jakarta' });
}

function formatValue(kpi: Kpi): string {
  // Steps: comma-separated whole number
  if (kpi.unit === 'steps') return Math.round(kpi.value).toLocaleString();
  // Weight (kg): always 1 decimal place
  if (kpi.unit === 'kg') {
    const rounded = Math.round(kpi.value * 10) / 10;
    return rounded.toFixed(1);
  }
  // All other metrics (Garmin integers): no decimals
  return String(Math.round(kpi.value));
}

function meaningColor(kpi: Kpi): string {
  if (kpi.progress !== null) {
    if (kpi.progress >= 80) return 'text-jarvis-success';
    if (kpi.progress >= 50) return 'text-jarvis-warn';
    return 'text-jarvis-danger';
  }
  if (kpi.trend === 'up') return 'text-jarvis-success';
  if (kpi.trend === 'down') return 'text-jarvis-danger';
  return 'text-jarvis-text-dim';
}

export default function KpiRow() {
  const { data, loading } = usePolling<KpisData>(
    () => fetchAuth('/api/kpis'),
    5 * 60 * 1000
  );

  const kpis = data?.kpis ?? [];

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="min-w-[180px] rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4 animate-pulse"
          >
            <div className="h-3 bg-jarvis-border rounded w-2/3 mb-3" />
            <div className="h-6 bg-jarvis-border rounded w-1/2 mb-2" />
            <div className="h-2 bg-jarvis-border rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
        <p className="text-sm text-jarvis-text-dim text-center">
          No KPIs configured yet. Add KPIs via Supabase to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
      {kpis.map((kpi) => {
        const trend = kpi.trend ? TREND_ICONS[kpi.trend] : null;
        const meaning = deriveMeaning(kpi);
        return (
          <div
            key={kpi.id}
            className="min-w-[180px] max-w-[220px] shrink-0 rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4"
          >
            <p className="text-[11px] uppercase tracking-wider text-jarvis-text-dim mb-0.5 truncate">
              {kpi.domainName}
            </p>
            <p className="text-[13px] text-jarvis-text-secondary mb-2 truncate">
              {kpi.name}
            </p>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl font-semibold text-jarvis-text-primary font-mono">
                {formatValue(kpi)}
              </span>
              {kpi.unit && (
                <span className="text-xs text-jarvis-text-dim">{kpi.unit}</span>
              )}
              {kpi.target !== null && (
                <span className="text-xs text-jarvis-text-dim">
                  / {kpi.target}
                </span>
              )}
              {trend && (
                <span className={`text-sm ${trend.color}`}>
                  {trend.symbol}
                </span>
              )}
            </div>
            {/* Qualifier — contextual label for scored metrics */}
            {kpi.qualifier && (
              <p className={`text-[11px] font-medium mb-1 ${qualifierColor(kpi.qualifier)}`}>
                {toSentenceCase(kpi.qualifier)}
              </p>
            )}
            {/* Meaning — the "so what" for this KPI */}
            {meaning && !kpi.qualifier && (
              <p className={`text-[11px] font-medium mb-2 ${meaningColor(kpi)}`}>
                {meaning}
              </p>
            )}
            {kpi.progress !== null && (
              <div className="h-1 rounded-full bg-jarvis-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    kpi.progress >= 80
                      ? 'bg-jarvis-success'
                      : kpi.progress >= 50
                        ? 'bg-jarvis-accent'
                        : 'bg-jarvis-warn'
                  }`}
                  style={{ width: `${Math.min(kpi.progress, 100)}%` }}
                />
              </div>
            )}
            {kpi.lastUpdated && (
              <p className="text-[10px] text-jarvis-text-dim mt-2">
                {formatDate(kpi.lastUpdated)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

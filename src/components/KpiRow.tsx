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
}

interface KpisData {
  kpis: Kpi[];
}

const TREND_ICONS: Record<string, { symbol: string; color: string }> = {
  up: { symbol: '\u2191', color: 'text-emerald-400' },
  down: { symbol: '\u2193', color: 'text-red-400' },
  flat: { symbol: '\u2192', color: 'text-jarvis-text-dim' },
};

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
        <p className="text-xs text-jarvis-text-dim text-center">
          No KPIs configured yet. Add KPIs via Supabase to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
      {kpis.map((kpi) => {
        const trend = kpi.trend ? TREND_ICONS[kpi.trend] : null;
        return (
          <div
            key={kpi.id}
            className="min-w-[180px] max-w-[220px] shrink-0 rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4"
          >
            <p className="text-[10px] uppercase tracking-wider text-jarvis-text-muted mb-1 truncate">
              {kpi.domainName}
            </p>
            <p className="text-xs text-jarvis-text-secondary mb-2 truncate">
              {kpi.name}
            </p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-xl font-semibold text-jarvis-text-primary font-mono">
                {kpi.value}
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
            {kpi.progress !== null && (
              <div className="h-1.5 rounded-full bg-jarvis-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    kpi.progress >= 80
                      ? 'bg-emerald-400'
                      : kpi.progress >= 50
                        ? 'bg-jarvis-accent'
                        : 'bg-jarvis-warn'
                  }`}
                  style={{ width: `${kpi.progress}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

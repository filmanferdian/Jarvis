'use client';

import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';

interface GarminDaily {
  steps: number | null;
  steps_goal: number | null;
  resting_hr: number | null;
  stress_level: number | null;
  hrv_status: string | null;
  hrv_7d_avg: number | null;
  sleep_score: number | null;
  sleep_duration_seconds: number | null;
  body_battery: number | null;
  body_battery_charged: number | null;
  body_battery_drained: number | null;
  training_readiness: number | null;
  training_status: string | null;
  vo2_max: number | null;
  calories_active: number | null;
  calories_total: number | null;
  fitness_age: number | null;
  endurance_score: number | null;
  training_load_acute: number | null;
  training_load_chronic: number | null;
  sleep_qualifier: string | null;
  stress_qualifier: string | null;
  body_battery_qualifier: string | null;
  training_readiness_qualifier: string | null;
  hrv_qualifier: string | null;
  resting_hr_qualifier: string | null;
}

interface Activity {
  activity_type: string;
  distance_meters: number | null;
  duration_seconds: number | null;
  avg_pace: string | null;
  avg_hr: number | null;
  started_at: string | null;
}

interface WeightPoint {
  date: string;
  weight_kg: number;
}

interface HealthData {
  date: string;
  garmin: (GarminDaily & { last_synced?: string }) | null;
  latestActivity: Activity | null;
  weight: {
    current: WeightPoint | null;
    trend: WeightPoint[];
  };
  timestamp: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function formatSleepDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m > 0 ? `${m}m` : ''}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

/** Returns true if the activity has meaningful distance (e.g., running, cycling) */
function hasDistance(act: Activity): boolean {
  return act.distance_meters != null && act.distance_meters > 10;
}

function qualifierColor(q: string): string {
  const upper = q.toUpperCase();
  const green = ['EXCELLENT', 'GOOD', 'BALANCED', 'PRODUCTIVE', 'CHARGED', 'ATHLETIC', 'RELAXED'];
  const orange = ['FAIR', 'MODERATE', 'MAINTAINING', 'UNBALANCED', 'NORMAL'];
  const red = ['POOR', 'LOW', 'DETRAINING', 'DRAINED', 'ELEVATED', 'HIGH'];
  if (green.includes(upper)) return 'text-emerald-400';
  if (orange.includes(upper)) return 'text-jarvis-warn';
  if (red.includes(upper)) return 'text-red-400';
  return 'text-jarvis-text-dim';
}

function toSentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function WeightSparkline({ data }: { data: WeightPoint[] }) {
  if (data.length < 2) return null;

  const weights = data.map((d) => d.weight_kg);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;

  const w = 200;
  const h = 40;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.weight_kg - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--color-jarvis-accent)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function HealthCard() {
  const { data, loading } = usePolling<HealthData>(
    () => fetchAuth('/api/health-fitness'),
    5 * 60 * 1000,
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
          <div className="h-3 bg-jarvis-border rounded w-2/3" />
          <div className="h-10 bg-jarvis-border rounded w-full mt-2" />
        </div>
      </div>
    );
  }

  const g = data?.garmin;
  const act = data?.latestActivity;
  const weight = data?.weight;

  const hasGarmin = g && (g.steps != null || g.resting_hr != null || g.sleep_score != null);
  const hasWeight = weight?.current;

  if (!hasGarmin && !hasWeight && !act) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <h2 className="text-[15px] font-medium text-jarvis-text-muted mb-2">
          Health & Fitness
        </h2>
        <p className="text-base text-jarvis-text-dim">
          No health data available yet. Garmin sync runs at 7am, 1pm, and 7pm.
        </p>
      </div>
    );
  }

  // Compute weight delta (last 7 days)
  let weightDelta: string | null = null;
  if (weight?.trend && weight.trend.length >= 2 && weight.current) {
    const oldest = weight.trend[0];
    const delta = (weight.current.weight_kg - oldest.weight_kg).toFixed(1);
    const sign = Number(delta) > 0 ? '+' : '';
    weightDelta = `${sign}${delta} kg`;
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-medium text-jarvis-text-primary">
          Health & Fitness
          {data?.date && (
            <span className="text-jarvis-text-muted ml-2 text-sm normal-case">
              · {new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </h2>
        {g?.last_synced && (
          <span className="text-xs text-jarvis-text-dim">
            Synced {new Date(g.last_synced).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Jakarta',
            })}
          </span>
        )}
      </div>

      {/* Sleep + Recovery row */}
      {g && (g.sleep_score != null || g.body_battery != null || g.training_readiness != null) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          {/* Sleep */}
          {g.sleep_score != null && (
            <div className="flex flex-col">
              <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">Sleep</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-jarvis-text-primary">
                  {g.sleep_score}<span className="text-xs text-jarvis-text-muted">/100</span>
                </span>
                {g.sleep_duration_seconds != null && (
                  <span className="text-sm text-jarvis-text-secondary">
                    · {formatSleepDuration(g.sleep_duration_seconds)}
                  </span>
                )}
              </div>
              {g.sleep_qualifier && (
                <span className={`text-[10px] font-medium ${qualifierColor(g.sleep_qualifier)}`}>
                  {toSentenceCase(g.sleep_qualifier)}
                </span>
              )}
            </div>
          )}

          {/* Recovery: Body Battery */}
          {g.body_battery != null && (
            <div className="flex flex-col">
              <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">Body Battery</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-jarvis-text-primary">
                  {g.body_battery}<span className="text-xs text-jarvis-text-muted">/100</span>
                </span>
                {g.body_battery_charged != null && (
                  <span className="text-sm text-jarvis-text-secondary">
                    · +{g.body_battery_charged} overnight
                  </span>
                )}
              </div>
              {g.body_battery_qualifier && (
                <span className={`text-[10px] font-medium ${qualifierColor(g.body_battery_qualifier)}`}>
                  {toSentenceCase(g.body_battery_qualifier)}
                </span>
              )}
            </div>
          )}

          {/* Training Readiness */}
          {g.training_readiness != null && (
            <div className="flex flex-col">
              <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">Readiness</span>
              <span className="text-base font-semibold text-jarvis-text-primary">
                {g.training_readiness}<span className="text-xs text-jarvis-text-muted">/100</span>
              </span>
              {g.training_readiness_qualifier && (
                <span className={`text-[10px] font-medium ${qualifierColor(g.training_readiness_qualifier)}`}>
                  {toSentenceCase(g.training_readiness_qualifier)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Last Activity — properly labeled */}
      {act && (
        <div className="border-t border-jarvis-border pt-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">Last Activity</span>
            {act.started_at && (
              <span className="text-xs text-jarvis-text-dim">{timeAgo(act.started_at)}</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-base font-medium text-jarvis-text-primary capitalize">
              {act.activity_type.replace(/_/g, ' ')}
            </span>
            <div className="flex flex-wrap items-center gap-3 text-sm text-jarvis-text-secondary">
              {hasDistance(act) && (
                <span>
                  <span className="text-jarvis-text-dim">Dist: </span>
                  {formatDistance(act.distance_meters!)}
                </span>
              )}
              {act.duration_seconds != null && (
                <span>
                  <span className="text-jarvis-text-dim">Duration: </span>
                  {formatDuration(act.duration_seconds)}
                </span>
              )}
              {act.avg_pace && hasDistance(act) && (
                <span>
                  <span className="text-jarvis-text-dim">Pace: </span>
                  {act.avg_pace}
                </span>
              )}
              {act.avg_hr != null && (
                <span>
                  <span className="text-jarvis-text-dim">Avg HR: </span>
                  {act.avg_hr} bpm
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weight trend */}
      {weight && weight.current && (
        <div className="border-t border-jarvis-border pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">Weight</span>
            <div className="flex items-baseline gap-2">
              {weightDelta && weightDelta !== '+0.0 kg' && weightDelta !== '-0.0 kg' && (
                <span className={`text-xs font-medium ${
                  weightDelta.startsWith('-') ? 'text-emerald-400' : 'text-jarvis-warn'
                }`}>
                  {weightDelta}
                </span>
              )}
              <span className="text-base font-semibold text-jarvis-text-primary">
                {weight.current.weight_kg} kg
              </span>
            </div>
          </div>
          {weight.trend.length >= 2 && <WeightSparkline data={weight.trend} />}
        </div>
      )}
    </div>
  );
}

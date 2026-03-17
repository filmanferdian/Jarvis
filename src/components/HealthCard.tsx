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
  garmin: GarminDaily | null;
  latestActivity: Activity | null;
  weight: {
    current: WeightPoint | null;
    trend: WeightPoint[];
  };
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

function StepsRing({ steps, goal }: { steps: number; goal: number }) {
  const pct = Math.min(steps / goal, 1);
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-jarvis-border)" strokeWidth="4" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke="var(--color-jarvis-accent)"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-jarvis-text-primary">
        {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps}
      </span>
    </div>
  );
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

function Metric({ label, value, unit, color }: { label: string; value: string | number | null; unit?: string; color?: string }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-jarvis-text-dim uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-semibold ${color || 'text-jarvis-text-primary'}`}>
        {value}{unit && <span className="text-[10px] text-jarvis-text-muted ml-0.5">{unit}</span>}
      </span>
    </div>
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

  if (!hasGarmin && !hasWeight) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <h2 className="text-sm font-medium text-jarvis-text-muted uppercase tracking-wider mb-2">
          Health & Fitness
        </h2>
        <p className="text-sm text-jarvis-text-dim">
          No health data available yet. Garmin sync runs daily, or trigger it manually via /api/sync/garmin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <h2 className="text-sm font-medium text-jarvis-accent uppercase tracking-wider mb-4">
        Health & Fitness
      </h2>

      {/* Vitals row */}
      {g && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-4">
          {g.steps != null && g.steps_goal != null ? (
            <div className="flex flex-col items-center">
              <StepsRing steps={g.steps} goal={g.steps_goal} />
              <span className="text-[10px] text-jarvis-text-dim mt-1">Steps</span>
            </div>
          ) : (
            <Metric label="Steps" value={g.steps} />
          )}
          <Metric label="Resting HR" value={g.resting_hr} unit="bpm" />
          <Metric label="Sleep" value={g.sleep_score} unit="/100" />
          <Metric label="Body Battery" value={g.body_battery} unit="/100" />
          <Metric label="Stress" value={g.stress_level} unit="/100" />
          <Metric label="HRV" value={g.hrv_status} />
        </div>
      )}

      {/* Fitness metrics row */}
      {g && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 mb-4">
          <Metric label="VO2 Max" value={g.vo2_max} />
          <Metric label="Readiness" value={g.training_readiness} unit="/100" />
          <Metric label="Status" value={g.training_status} />
          <Metric label="Endurance" value={g.endurance_score} />
          <Metric label="Fitness Age" value={g.fitness_age} />
        </div>
      )}

      {/* Calories + Training Load */}
      {g && (g.calories_total != null || g.training_load_acute != null) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <Metric label="Calories" value={g.calories_total} unit="kcal" />
          <Metric label="Active Cal" value={g.calories_active} unit="kcal" />
          <Metric label="Load (Acute)" value={g.training_load_acute ? Math.round(g.training_load_acute) : null} />
          <Metric label="Load (Chronic)" value={g.training_load_chronic ? Math.round(g.training_load_chronic) : null} />
        </div>
      )}

      {/* Last Activity */}
      {act && (
        <div className="border-t border-jarvis-border pt-3 mb-4">
          <span className="text-[10px] text-jarvis-text-dim uppercase tracking-wider">Last Activity</span>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm font-medium text-jarvis-text-primary capitalize">{act.activity_type}</span>
            {act.distance_meters != null && (
              <span className="text-sm text-jarvis-text-secondary">{formatDistance(act.distance_meters)}</span>
            )}
            {act.duration_seconds != null && (
              <span className="text-sm text-jarvis-text-secondary">{formatDuration(act.duration_seconds)}</span>
            )}
            {act.avg_pace && (
              <span className="text-sm text-jarvis-text-muted">{act.avg_pace}</span>
            )}
            {act.avg_hr != null && (
              <span className="text-sm text-jarvis-text-muted">{act.avg_hr} bpm</span>
            )}
          </div>
        </div>
      )}

      {/* Weight trend */}
      {weight && weight.current && (
        <div className="border-t border-jarvis-border pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-jarvis-text-dim uppercase tracking-wider">Weight</span>
            <span className="text-sm font-semibold text-jarvis-text-primary">
              {weight.current.weight_kg} kg
            </span>
          </div>
          {weight.trend.length >= 2 && <WeightSparkline data={weight.trend} />}
        </div>
      )}
    </div>
  );
}

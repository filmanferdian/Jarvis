'use client';

interface KrProgress {
  key_result: string;
  target_value: number;
  target_direction: string;
  unit: string;
  baseline_value: number | null;
  current_value: number | null;
  progress_pct: number | null;
  last_updated: string | null;
  status: 'on_track' | 'behind' | 'off_track' | 'no_data';
}

interface OkrCardProps {
  objective: string;
  label: string;
  keyResults: KrProgress[];
  overallPct: number | null;
}

const STATUS_COLORS = {
  on_track: 'bg-jarvis-success',
  behind: 'bg-jarvis-warn',
  off_track: 'bg-jarvis-danger',
  no_data: 'bg-jarvis-border',
};

const STATUS_TEXT_COLORS = {
  on_track: 'text-jarvis-success',
  behind: 'text-jarvis-warn',
  off_track: 'text-jarvis-danger',
  no_data: 'text-jarvis-text-dim',
};

const KR_LABELS: Record<string, string> = {
  weight: 'Weight',
  body_fat: 'Body Fat',
  waist_cm: 'Waist',
  lean_body_mass: 'Lean Mass',
  vo2_max: 'VO2 Max',
  run_10k_seconds: '10k Run',
  fitness_age: 'Fitness Age',
  resting_hr: 'Resting HR',
  dead_hang_seconds: 'Dead Hang',
  training_completion: 'Training %',
  daily_steps: 'Steps',
  overhead_squat_compensations: 'OHS',
  hba1c: 'HbA1c',
  fasting_glucose: 'Glucose',
  triglycerides: 'Triglycerides',
  hdl: 'HDL',
  bp_systolic: 'BP Sys',
  bp_diastolic: 'BP Dia',
  testosterone: 'Testosterone',
  sleep_hours: 'Sleep',
  hrv_decline_pct: 'HRV Decline',
  body_battery_wake: 'Body Battery',
  stress_avg: 'Stress',
};

function formatValue(kr: KrProgress): string {
  if (kr.current_value == null) return '—';
  const v = kr.current_value;
  if (kr.key_result === 'run_10k_seconds' || kr.key_result === 'dead_hang_seconds') {
    const min = Math.floor(v / 60);
    const sec = Math.round(v % 60);
    return `${min}:${String(sec).padStart(2, '0')}`;
  }
  // Steps: round to whole number with comma separator
  if (kr.key_result === 'daily_steps') {
    return Math.round(v).toLocaleString();
  }
  // Percentage metrics: whole number + %
  if (kr.key_result === 'training_completion') {
    return `${Math.round(v)}%`;
  }
  // Round to 1 decimal, drop .0 for whole numbers
  const rounded = Math.round(v * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

export default function OkrCard({ objective, label, keyResults, overallPct }: OkrCardProps) {
  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-jarvis-accent uppercase tracking-wider">{objective}</span>
          <h3 className="text-base font-semibold text-jarvis-text-primary">{label}</h3>
        </div>
        {overallPct != null ? (
          <span className="text-lg font-mono font-semibold text-jarvis-text-primary">{overallPct}%</span>
        ) : (
          <span className="text-sm text-jarvis-text-dim">No data</span>
        )}
      </div>

      <div className="space-y-2">
        {keyResults.map((kr) => (
          <div key={kr.key_result} className="flex items-center gap-2">
            <span className="text-sm text-jarvis-text-secondary w-24 shrink-0 truncate">
              {KR_LABELS[kr.key_result] || kr.key_result}
            </span>
            <div className="flex-1 h-2 bg-jarvis-border rounded-full overflow-hidden">
              {kr.progress_pct != null && (
                <div
                  className={`h-full rounded-full transition-all ${STATUS_COLORS[kr.status]}`}
                  style={{ width: `${Math.min(100, kr.progress_pct)}%` }}
                />
              )}
            </div>
            <span className={`text-sm font-mono w-16 text-right ${STATUS_TEXT_COLORS[kr.status]}`}>
              {kr.current_value != null ? (
                <>
                  {formatValue(kr)}
                  <span className="text-jarvis-text-dim">→{kr.target_value}</span>
                </>
              ) : (
                <span className="text-jarvis-text-dim">—</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Stale data warning */}
      {keyResults.some((kr) => kr.status === 'no_data') && (
        <p className="text-xs text-jarvis-warn mt-2">
          ⚠ {keyResults.filter((kr) => kr.status === 'no_data').length} metric(s) have no data
        </p>
      )}
    </div>
  );
}

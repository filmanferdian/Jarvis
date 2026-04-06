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
  context?: string;
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

const STATUS_LABELS: Record<string, string> = {
  on_track: 'On track',
  behind: 'Behind',
  off_track: 'Off track',
  no_data: 'No data',
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
  training_completion: 'Training',
  daily_steps: 'Steps',
  overhead_squat_compensations: 'OHS',
  hba1c: 'HbA1c',
  fasting_glucose: 'Glucose',
  triglycerides: 'Triglycerides',
  hdl: 'HDL',
  bp_systolic: 'BP Systolic',
  bp_diastolic: 'BP Diastolic',
  testosterone: 'Testosterone',
  sleep_hours: 'Sleep',
  hrv_decline_pct: 'HRV Decline',
  body_battery_wake: 'Body Battery',
  stress_avg: 'Stress',
};

/** Format a metric value with consistent rules — used for baseline, current, AND target */
function formatMetricValue(keyResult: string, value: number | null, unit: string): string {
  if (value == null) return '—';

  // Time-based: mm:ss
  if (keyResult === 'run_10k_seconds' || keyResult === 'dead_hang_seconds') {
    const min = Math.floor(value / 60);
    const sec = Math.round(value % 60);
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  // Steps: comma-separated integer
  if (keyResult === 'daily_steps') {
    return Math.round(value).toLocaleString();
  }

  // Percentage-like metrics
  if (keyResult === 'training_completion' || keyResult === 'hrv_decline_pct') {
    return `${Math.round(value)}`;
  }

  // Body fat: 1 decimal
  if (keyResult === 'body_fat') {
    return value.toFixed(1);
  }

  // HbA1c: 1 decimal (special — small number)
  if (keyResult === 'hba1c') {
    return value.toFixed(1);
  }

  // Weight, waist, lean mass: 1 decimal
  if (keyResult === 'weight' || keyResult === 'waist_cm' || keyResult === 'lean_body_mass') {
    return value % 1 === 0 ? String(value) : value.toFixed(1);
  }

  // Sleep hours: always 1 decimal
  if (keyResult === 'sleep_hours') {
    return value.toFixed(1);
  }

  // Integer metrics (HR, HRV, stress, body battery, glucose, BP, fitness age, etc.)
  if (['resting_hr', 'stress_avg', 'body_battery_wake', 'fitness_age', 'fasting_glucose', 'triglycerides', 'hdl', 'bp_systolic', 'bp_diastolic', 'testosterone', 'overhead_squat_compensations'].includes(keyResult)) {
    return String(Math.round(value));
  }

  // Default: 1 decimal, drop .0
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

/** Get a short unit label for display */
function getUnitLabel(keyResult: string, unit: string): string {
  // Time-based metrics don't need extra unit — format already shows mm:ss
  if (keyResult === 'run_10k_seconds' || keyResult === 'dead_hang_seconds') return '';

  const unitMap: Record<string, string> = {
    kg: 'kg',
    '%': '%',
    cm: 'cm',
    bpm: 'bpm',
    'ml/kg/min': 'ml/kg/min',
    years: 'yr',
    seconds: 's',
    steps: 'steps',
    count: '',
    hours: 'hrs',
    level: '',
    '/100': '',
    'mg/dL': 'mg/dL',
    mmHg: 'mmHg',
    'ng/dL': 'ng/dL',
  };
  return unitMap[unit] || unit;
}

export default function OkrCard({ objective, label, keyResults, overallPct }: OkrCardProps) {
  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-mono text-jarvis-accent uppercase tracking-wider">{objective}</span>
          <h3 className="text-base font-semibold text-jarvis-text-primary">{label}</h3>
        </div>
        {overallPct != null ? (
          <div className="text-right">
            <span className="text-lg font-mono font-semibold text-jarvis-text-primary">{overallPct}%</span>
          </div>
        ) : (
          <span className="text-sm text-jarvis-text-dim">No data</span>
        )}
      </div>

      {/* Key Results */}
      <div className="space-y-3">
        {keyResults.map((kr) => {
          const unitLabel = getUnitLabel(kr.key_result, kr.unit);
          const currentFormatted = formatMetricValue(kr.key_result, kr.current_value, kr.unit);
          const targetFormatted = formatMetricValue(kr.key_result, kr.target_value, kr.unit);
          const baselineFormatted = formatMetricValue(kr.key_result, kr.baseline_value, kr.unit);
          const hasData = kr.current_value != null;
          const hasBaseline = kr.baseline_value != null;

          return (
            <div key={kr.key_result}>
              {/* Row 1: Label + Status + Values */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-jarvis-text-secondary">
                    {KR_LABELS[kr.key_result] || kr.key_result}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[kr.status]} bg-opacity-20 ${STATUS_TEXT_COLORS[kr.status]}`}>
                    {STATUS_LABELS[kr.status]}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 text-sm font-mono">
                  {hasData ? (
                    <>
                      <span className={STATUS_TEXT_COLORS[kr.status]}>
                        {currentFormatted}
                      </span>
                      <span className="text-jarvis-text-dim">/</span>
                      <span className="text-jarvis-text-dim">{targetFormatted}</span>
                      {unitLabel && (
                        <span className="text-[11px] text-jarvis-text-dim ml-0.5">{unitLabel}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-jarvis-text-dim">— / {targetFormatted}{unitLabel ? ` ${unitLabel}` : ''}</span>
                  )}
                </div>
              </div>

              {/* Row 2: Progress bar */}
              <div className="relative h-2.5 bg-jarvis-border rounded-full overflow-hidden">
                {kr.progress_pct != null && (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${STATUS_COLORS[kr.status]}`}
                    style={{ width: `${Math.min(100, kr.progress_pct)}%` }}
                  />
                )}
              </div>

              {/* Row 3: Context + baseline annotation */}
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-jarvis-text-dim">
                  {kr.context
                    ? hasBaseline
                      ? `${kr.context} · Baseline: ${baselineFormatted}${unitLabel ? ` ${unitLabel}` : ''}`
                      : kr.context
                    : hasBaseline
                      ? `Baseline: ${baselineFormatted}${unitLabel ? ` ${unitLabel}` : ''}`
                      : 'No baseline'}
                </span>
                {hasData && hasBaseline && kr.progress_pct != null && (
                  <span className="text-[10px] text-jarvis-text-dim">
                    {kr.progress_pct}% of goal
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

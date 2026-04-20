'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';
import OkrCard, { type RidgelineObjective } from '@/components/health/OkrCard';
import BloodWorkPanel from '@/components/health/BloodWorkPanel';
import ManualEntryForm from '@/components/health/ManualEntryForm';
import HealthInsights from '@/components/health/HealthInsights';

interface KrProgress {
  key_result: string;
  target_value: number;
  target_direction: string;
  unit: string;
  baseline_value: number | null;
  current_value: number | null;
  previous_value: number | null;
  progress_pct: number | null;
  last_updated: string | null;
  status: 'on_track' | 'behind' | 'off_track' | 'no_data';
  context?: string;
}

interface ObjectiveProgress {
  objective: string;
  label: string;
  key_results: KrProgress[];
  overall_pct: number | null;
}

interface OkrResponse {
  objectives: ObjectiveProgress[];
  totalScore: number | null;
}

interface BloodWorkEntry {
  marker_name: string;
  value: number;
  unit: string;
  reference_low: number | null;
  reference_high: number | null;
  test_date: string;
}

interface FitnessContext {
  current_week: number;
  current_phase: string;
}

const KR_DISPLAY_LABELS: Record<string, string> = {
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

const HEADLINE_METRICS: Array<{ key: string; unit: string }> = [
  { key: 'resting_hr', unit: 'bpm' },
  { key: 'vo2_max', unit: 'ml/kg/min' },
  { key: 'weight', unit: 'kg' },
];

function synthHistory(currentPct: number | null): number[] {
  if (currentPct == null || currentPct <= 0) return Array(14).fill(0);
  const n = 14;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const eased = 1 - Math.pow(1 - t, 2.2);
    out.push(Math.round(currentPct * eased));
  }
  return out;
}

function toneFor(status: KrProgress['status']): string {
  switch (status) {
    case 'on_track':
      return 'var(--color-jarvis-good)';
    case 'behind':
      return 'var(--color-jarvis-warn)';
    case 'off_track':
      return 'var(--color-jarvis-danger)';
    default:
      return 'var(--color-jarvis-text-faint)';
  }
}

function formatHeadlineValue(kr: KrProgress): string {
  if (kr.current_value == null) return '—';
  if (kr.key_result === 'weight') {
    return kr.current_value % 1 === 0 ? String(kr.current_value) : kr.current_value.toFixed(1);
  }
  if (kr.key_result === 'vo2_max') return kr.current_value.toFixed(1);
  return String(Math.round(kr.current_value));
}

function formatDelta(kr: KrProgress): { text: string; good: boolean } | null {
  if (kr.current_value == null || kr.previous_value == null) return null;
  const diff = kr.current_value - kr.previous_value;
  if (Math.abs(diff) < 0.05) return { text: 'stable', good: true };
  const isUp = diff > 0;
  const rounded = Math.abs(diff) < 1 ? Math.abs(diff).toFixed(1) : Math.round(Math.abs(diff)).toString();
  const good =
    kr.target_direction === 'lower_is_better'
      ? !isUp
      : kr.target_direction === 'higher_is_better'
        ? isUp
        : true;
  return { text: `${isUp ? '↑' : '↓'} ${rounded}`, good };
}

function buildNarrative(totalScore: number | null, objectives: ObjectiveProgress[]): string {
  const allKrs = objectives.flatMap((o) => o.key_results);
  const onTrack = allKrs.filter((k) => k.status === 'on_track').length;
  const trackable = allKrs.filter((k) => k.status !== 'no_data').length;
  const weakest = allKrs
    .filter((k) => k.status === 'off_track' || k.status === 'behind')
    .sort((a, b) => (a.progress_pct ?? 0) - (b.progress_pct ?? 0))[0];

  const score = totalScore ?? 0;
  const headline =
    score >= 70
      ? 'Strong cycle.'
      : score >= 40
        ? 'Mid-cycle momentum.'
        : 'Early days — build the base.';

  const weakestLabel = weakest ? KR_DISPLAY_LABELS[weakest.key_result] || weakest.key_result : null;
  const trendClause = trackable > 0 ? `**${onTrack} of ${trackable}** KRs on track` : 'no live KR data yet';
  const focusClause = weakestLabel ? ` — watch **${weakestLabel}**.` : '.';
  return `${headline} ${trendClause}${focusClause}`;
}

function renderNarrative(narrative: string) {
  return narrative.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} style={{ color: 'var(--color-jarvis-ambient)' }}>
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function HealthPage() {
  const [okrData, setOkrData] = useState<OkrResponse | null>(null);
  const [bloodWork, setBloodWork] = useState<BloodWorkEntry[]>([]);
  const [fitnessCtx, setFitnessCtx] = useState<FitnessContext | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [okr, fitness] = await Promise.allSettled([
        fetchAuth<OkrResponse>('/api/health-fitness/okr'),
        fetchAuth<{ context: FitnessContext }>('/api/fitness'),
      ]);

      if (okr.status === 'fulfilled') setOkrData(okr.value);
      if (fitness.status === 'fulfilled') setFitnessCtx(fitness.value.context);

      try {
        const res = await fetch('/api/health-fitness/blood-work', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setBloodWork(data.entries || []);
        }
      } catch {
        // Blood work endpoint may not exist yet
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalScore = okrData?.totalScore ?? null;
  const narrative = okrData ? buildNarrative(totalScore, okrData.objectives) : '';
  const lastBloodDate = bloodWork.length > 0 ? bloodWork[0].test_date : null;

  const headlineCards: Array<{ key: string; unit: string; kr: KrProgress }> = (() => {
    if (!okrData) return [];
    const flat = okrData.objectives.flatMap((o) => o.key_results);
    const picks: Array<{ key: string; unit: string; kr: KrProgress }> = [];
    for (const { key, unit } of HEADLINE_METRICS) {
      const kr = flat.find((k) => k.key_result === key);
      if (kr) picks.push({ key, unit, kr });
    }
    return picks;
  })();

  const ridgelineObjectives: RidgelineObjective[] = okrData
    ? okrData.objectives.map((o) => ({
        name: o.label,
        krs: o.key_results.length,
        current: o.overall_pct ?? 0,
        history: synthHistory(o.overall_pct),
      }))
    : [];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-jarvis-text-dim">
          <a href="/" className="hover:text-jarvis-cta transition-colors">Dashboard</a>
          <span>/</span>
          <span className="text-jarvis-text-primary">Health &amp; Fitness</span>
        </div>

        {/* Narrative-hero */}
        <div
          className="rounded-[14px] border p-5 sm:p-7 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 md:gap-8 items-center"
          style={{
            background: 'var(--color-jarvis-bg-card)',
            borderColor: 'var(--color-jarvis-border)',
          }}
        >
          <div>
            <div className="font-[family-name:var(--font-display)] font-medium leading-none tracking-[-0.02em]">
              <span className="text-[56px] sm:text-[72px] text-jarvis-text-primary">{totalScore ?? '—'}</span>
              <span className="text-[16px] text-jarvis-text-faint ml-1">/100</span>
            </div>
            <p className="mt-2 font-mono text-[11px] text-jarvis-text-dim uppercase tracking-[0.15em]">
              Readiness
            </p>
            {fitnessCtx && (
              <p className="mt-1 font-mono text-[11px] text-jarvis-text-faint">
                Week {fitnessCtx.current_week} · {fitnessCtx.current_phase}
              </p>
            )}
          </div>
          <p className="font-[family-name:var(--font-display)] text-[18px] leading-[1.45] tracking-[-0.005em] text-jarvis-text-primary m-0">
            {narrative
              ? renderNarrative(narrative)
              : loading
                ? 'Loading readiness…'
                : 'No OKR data yet.'}
          </p>
        </div>

        {/* Health-grid: 3 headline metric cards */}
        {headlineCards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {headlineCards.map(({ key, unit, kr }) => {
              const delta = formatDelta(kr);
              return (
                <div
                  key={key}
                  className="rounded-[12px] border p-4 flex flex-col gap-1 min-h-[108px] relative overflow-hidden"
                  style={{
                    background: 'var(--color-jarvis-bg-card)',
                    borderColor: 'var(--color-jarvis-border)',
                  }}
                >
                  <span className="font-mono text-[9.5px] tracking-[0.15em] uppercase text-jarvis-text-faint">
                    {KR_DISPLAY_LABELS[key] || key}
                  </span>
                  <span
                    className="font-[family-name:var(--font-display)] font-medium text-[26px] leading-none tracking-[-0.02em] mt-0.5"
                    style={{ color: toneFor(kr.status) }}
                  >
                    {formatHeadlineValue(kr)}
                    <span className="text-[11px] text-jarvis-text-faint font-normal ml-1">{unit}</span>
                  </span>
                  <span className="font-mono text-[11px] mt-auto flex items-center gap-1">
                    {delta ? (
                      <span style={{ color: delta.good ? 'var(--color-jarvis-good)' : 'var(--color-jarvis-danger)' }}>
                        {delta.text}
                      </span>
                    ) : (
                      <span className="text-jarvis-text-faint">no delta</span>
                    )}
                    <span className="text-jarvis-text-faint">
                      · target {kr.target_value}{unit ? ` ${unit}` : ''}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Skeleton while loading */}
        {loading && !okrData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[108px] rounded-[12px] border animate-pulse"
                style={{
                  background: 'var(--color-jarvis-bg-card)',
                  borderColor: 'var(--color-jarvis-border)',
                }}
              />
            ))}
          </div>
        )}

        {/* OKR Ridgeline */}
        {ridgelineObjectives.length > 0 && <OkrCard objectives={ridgelineObjectives} />}

        {/* Blood-work panel */}
        <BloodWorkPanel entries={bloodWork} lastTestDate={lastBloodDate} />

        {/* AI Health Insights (narrative-annotation slot) */}
        <HealthInsights narrative={narrative} />

        {/* Manual Entry */}
        <ManualEntryForm onSaved={loadData} />
      </div>
    </AppShell>
  );
}

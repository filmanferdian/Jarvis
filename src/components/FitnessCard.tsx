'use client';

import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface EatingWindow {
  open: string;
  close: string;
  pre_workout?: string;
}

interface TrainingDay {
  type: string;
  focus: string;
  exercises?: Array<{ name: string; sets: number; reps: string; rest: string; notes?: string }>;
  total_sets?: number;
  duration?: string;
}

interface FitnessData {
  available: boolean;
  day: string;
  current_week: number;
  current_phase: string;
  phase_end_week: number;
  is_training_day: boolean;
  is_deload_week: boolean;
  training: TrainingDay | null;
  cardio: string | null;
  macros: MacroTargets;
  eating_window: EatingWindow | null;
  next_deload_week: number | null;
  weeks_to_deload: number | null;
  special_notes: string | null;
  synced_at: string;
}

function MacroBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-sm text-jarvis-text-muted">{label}</span>
      <span className="text-sm font-semibold text-jarvis-text-primary">{value}g</span>
    </div>
  );
}

export default function FitnessCard() {
  const { data, loading } = usePolling<FitnessData>(
    () => fetchAuth('/api/fitness'),
    5 * 60 * 1000,
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
          <div className="h-3 bg-jarvis-border rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!data?.available) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <h2 className="text-[15px] font-medium text-jarvis-text-muted mb-2">
          Fitness Program
        </h2>
        <p className="text-base text-jarvis-text-dim">
          No fitness context synced. Run POST /api/sync/fitness to initialize.
        </p>
      </div>
    );
  }

  const { is_training_day, is_deload_week, training, cardio, macros, eating_window, current_week, current_phase, next_deload_week, weeks_to_deload } = data;

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-medium text-jarvis-text-primary">
          Fitness Program
        </h2>
        <span className="text-sm text-jarvis-text-dim">
          Week {current_week} · {current_phase}
        </span>
      </div>

      {/* Today's training type */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-lg font-bold ${is_training_day ? 'text-jarvis-text-primary' : 'text-jarvis-text-muted'}`}>
            {is_training_day && training ? training.type : 'Rest Day'}
          </span>
          {is_deload_week && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium uppercase">
              Deload
            </span>
          )}
        </div>
        {cardio && (
          <p className="text-base text-jarvis-text-secondary">
            Cardio: {cardio}
          </p>
        )}
      </div>

      {/* Exercises (collapsed by default, expandable) */}
      {is_training_day && training?.exercises && training.exercises.length > 0 && (
        <details className="mb-4">
          <summary className="text-sm text-jarvis-text-muted uppercase tracking-wider cursor-pointer hover:text-jarvis-text-secondary">
            Exercises ({training.total_sets || training.exercises.length} sets · {training.duration || '60-75min'})
          </summary>
          <div className="mt-2 space-y-1">
            {training.exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between text-base">
                <span className="text-jarvis-text-secondary">{ex.name}</span>
                <span className="text-jarvis-text-muted text-sm">
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Macros */}
      <div className="border-t border-jarvis-border pt-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">
            Macros ({is_training_day ? 'Training' : 'Rest'} Day)
          </span>
          <span className="text-base font-bold text-jarvis-text-primary">
            {macros.calories} kcal
          </span>
        </div>
        <div className="flex gap-4">
          <MacroBar label="Protein" value={macros.protein} color="bg-blue-400" />
          <MacroBar label="Carbs" value={macros.carbs} color="bg-amber-400" />
          <MacroBar label="Fat" value={macros.fat} color="bg-red-400" />
        </div>
      </div>

      {/* Eating window + Deload info */}
      <div className="border-t border-jarvis-border pt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-jarvis-text-muted">
        {eating_window && (
          <span>Eating: {eating_window.open} – {eating_window.close}</span>
        )}
        {is_training_day && eating_window?.pre_workout && (
          <span>Pre-workout: {eating_window.pre_workout}</span>
        )}
        {next_deload_week && weeks_to_deload != null && weeks_to_deload > 0 && (
          <span>Deload: W{next_deload_week} ({weeks_to_deload}w away)</span>
        )}
      </div>
    </div>
  );
}

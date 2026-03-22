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
  date: string;
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
  steps_target: number;
  next_deload_week: number | null;
  weeks_to_deload: number | null;
  special_notes: string | null;
  synced_at: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Jakarta' });
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
          No fitness context synced yet.
        </p>
      </div>
    );
  }

  const { is_training_day, is_deload_week, training, cardio, macros, eating_window, steps_target, current_week, current_phase, next_deload_week, weeks_to_deload } = data;

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6 space-y-4">

      {/* 1. Day, Date, Week & Phase + Deload */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-jarvis-text-primary">
            Fitness Program
          </h2>
          <div className="flex items-center gap-2">
            {is_deload_week && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                Deload
              </span>
            )}
            {next_deload_week && weeks_to_deload != null && weeks_to_deload > 0 && !is_deload_week && (
              <span className="text-xs text-jarvis-text-dim">
                Deload W{next_deload_week}
              </span>
            )}
            <span className="text-sm text-jarvis-text-dim">
              Week {current_week} · {current_phase}
            </span>
          </div>
        </div>
        <span className="text-sm text-jarvis-text-muted">
          {data.date ? formatDate(data.date) : capitalize(data.day)}
        </span>
      </div>

      {/* 2. Theme: Training vs Rest + Synthesis */}
      <div className="border-t border-jarvis-border pt-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${is_training_day ? 'bg-emerald-400' : 'bg-jarvis-text-dim'}`} />
          <span className={`text-lg font-bold ${is_training_day ? 'text-jarvis-text-primary' : 'text-jarvis-text-muted'}`}>
            {is_training_day && training ? training.type : 'Rest Day'}
          </span>
        </div>
        <p className="text-sm text-jarvis-text-secondary mt-1">
          {is_training_day && training
            ? `${training.focus} session${training.duration ? ` · ${training.duration}` : ''}`
            : 'Recovery and light activity day'}
        </p>
      </div>

      {/* 3. Exercises (collapsible) */}
      {is_training_day && training?.exercises && training.exercises.length > 0 && (
        <details className="border-t border-jarvis-border pt-3">
          <summary className="text-sm text-jarvis-text-muted uppercase tracking-wider cursor-pointer hover:text-jarvis-text-secondary transition-colors">
            Exercises ({training.total_sets || training.exercises.length} sets)
          </summary>
          <div className="mt-2 space-y-1">
            {training.exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between text-base">
                <span className="text-jarvis-text-secondary">{ex.name}</span>
                <span className="text-jarvis-text-muted text-sm">
                  {ex.sets}×{ex.reps}{ex.rest ? ` · ${ex.rest}` : ''}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 4. Cardio */}
      {cardio && cardio !== 'REST' && (
        <div className="border-t border-jarvis-border pt-3">
          <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">Cardio</span>
          <p className="text-base text-jarvis-text-primary mt-0.5">{cardio}</p>
        </div>
      )}

      {/* 5. Steps Target */}
      <div className="border-t border-jarvis-border pt-3">
        <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">Steps Target</span>
        <p className="text-base font-semibold text-jarvis-text-primary mt-0.5">
          {steps_target.toLocaleString()} steps
        </p>
      </div>

      {/* 6. Macros */}
      <div className="border-t border-jarvis-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-jarvis-text-dim uppercase tracking-wider">
            Macros ({is_training_day ? 'Training' : 'Rest'} Day)
          </span>
          <span className="text-base font-bold text-jarvis-text-primary">
            {macros.calories} kcal
          </span>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-sm text-jarvis-text-muted">Protein</span>
            <span className="text-sm font-semibold text-jarvis-text-primary">{macros.protein}g</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm text-jarvis-text-muted">Carbs</span>
            <span className="text-sm font-semibold text-jarvis-text-primary">{macros.carbs}g</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-sm text-jarvis-text-muted">Fat</span>
            <span className="text-sm font-semibold text-jarvis-text-primary">{macros.fat}g</span>
          </div>
        </div>
      </div>

      {/* 7. Eating Window */}
      {eating_window && (
        <div className="border-t border-jarvis-border pt-3 text-sm text-jarvis-text-muted">
          Eating: {eating_window.open} – {eating_window.close}
        </div>
      )}
    </div>
  );
}

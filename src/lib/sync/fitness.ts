import { supabase } from '@/lib/supabase';

export interface FitnessContext {
  current_week: number;
  current_phase: string;
  phase_end_week: number;
  phase_tone: string;
  training_day_map: Record<string, TrainingDay>;
  cardio_schedule: Record<string, string>;
  macro_training: MacroTargets;
  macro_rest: MacroTargets;
  eating_window: EatingWindow;
  milestones: Milestone[];
  next_deload_week: number;
  daily_habits: DailyHabits;
  special_notes: string;
  active_subpages: string[];
}

interface TrainingDay {
  type: string;
  focus: string;
  exercises: Exercise[];
  total_sets: number;
  duration: string;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

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

interface Milestone {
  week: number;
  weight: string;
  marker: string;
}

interface DailyHabits {
  wake_time: string;
  cardio_time: string;
  training_time: string;
  sleep_target: string;
  wind_down: string;
  lights_out: string;
}

// --- Supabase program_schedule row ---

interface ScheduleRow {
  day_number: number;
  date: string;
  day_of_week: string;
  week: number;
  phase: string;
  day_type: 'Training' | 'Rest';
  training: string | null;
  cardio: string;
  deload: boolean;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps_target: number;
  eating_open: string;
  eating_close: string;
}

// --- Sync Logic ---

export interface FitnessSyncResult {
  synced: boolean;
  skipped: boolean;
  current_week: number;
  current_phase: string;
  timestamp: string;
}

export async function syncFitness(force = false): Promise<FitnessSyncResult> {
  const timestamp = new Date().toISOString();

  // Get today's date in WIB
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(Date.now() + wibOffset);
  const today = wibDate.toISOString().split('T')[0];

  // Skip if already synced today (unless forced)
  if (!force) {
    const { data: existing } = await supabase
      .from('fitness_context')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    if (existing?.synced_at) {
      const lastSyncWib = new Date(new Date(existing.synced_at).getTime() + wibOffset);
      const lastSyncDate = lastSyncWib.toISOString().split('T')[0];
      if (lastSyncDate === today) {
        // Already synced today — fetch week/phase for the response
        const { data: ctx } = await supabase
          .from('fitness_context')
          .select('current_week, current_phase')
          .single();
        return {
          synced: false,
          skipped: true,
          current_week: ctx?.current_week || 0,
          current_phase: ctx?.current_phase || '',
          timestamp,
        };
      }
    }
  }

  // Query today's row from program_schedule
  const { data: todayRows, error: todayErr } = await supabase
    .from('program_schedule')
    .select('*')
    .eq('date', today)
    .limit(1);

  if (todayErr) throw todayErr;

  if (!todayRows || todayRows.length === 0) {
    console.warn(`[fitness] No schedule row found for ${today}`);
    return { synced: false, skipped: true, current_week: 0, current_phase: '', timestamp };
  }

  const todayRow = todayRows[0] as ScheduleRow;

  // Fetch the full week's rows
  const { data: weekRows, error: weekErr } = await supabase
    .from('program_schedule')
    .select('*')
    .eq('week', todayRow.week)
    .order('date', { ascending: true });

  if (weekErr) throw weekErr;

  const rows = (weekRows || []) as ScheduleRow[];

  // Build training_day_map and cardio_schedule keyed by lowercase day name
  const trainingDayMap: Record<string, TrainingDay> = {};
  const cardioSchedule: Record<string, string> = {};

  for (const row of rows) {
    const dayName = row.day_of_week.toLowerCase();

    trainingDayMap[dayName] = {
      type: row.day_type === 'Training' ? (row.training || 'Training') : 'Rest',
      focus: row.day_type === 'Training' ? (row.training || 'Training') : 'Recovery',
      exercises: [],
      total_sets: 0,
      duration: '',
    };

    cardioSchedule[dayName] = row.cardio || 'REST';
  }

  // Build macro targets from a training day and rest day in the week
  const trainingRow = rows.find((r) => r.day_type === 'Training') || todayRow;
  const restRow = rows.find((r) => r.day_type === 'Rest') || todayRow;

  const macroTraining: MacroTargets = {
    calories: trainingRow.calories,
    protein: trainingRow.protein,
    carbs: trainingRow.carbs,
    fat: trainingRow.fat,
  };

  const macroRest: MacroTargets = {
    calories: restRow.calories,
    protein: restRow.protein,
    carbs: restRow.carbs,
    fat: restRow.fat,
  };

  const eatingWindow: EatingWindow = {
    open: todayRow.eating_open,
    close: todayRow.eating_close,
  };

  // Find next deload week
  let nextDeloadWeek: number | null = null;
  if (!todayRow.deload) {
    const { data: deloadRows } = await supabase
      .from('program_schedule')
      .select('week')
      .eq('deload', true)
      .gt('date', today)
      .order('date', { ascending: true })
      .limit(1);

    if (deloadRows && deloadRows.length > 0) {
      nextDeloadWeek = deloadRows[0].week;
    }
  }

  // Upsert to fitness_context (delete old, insert new — single row)
  await supabase.from('fitness_context').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await supabase.from('fitness_context').insert({
    current_week: todayRow.week,
    current_phase: todayRow.phase,
    phase_end_week: null,
    phase_tone: null,
    training_day_map: trainingDayMap,
    cardio_schedule: cardioSchedule,
    macro_training: macroTraining,
    macro_rest: macroRest,
    eating_window: eatingWindow,
    milestones: null,
    next_deload_week: nextDeloadWeek ?? todayRow.week,
    daily_habits: null,
    steps_target: todayRow.steps_target,
    special_notes: todayRow.deload ? 'Deload week' : null,
    active_subpages: [],
    notion_page_id: null,
    notion_last_edited: null,
    synced_at: timestamp,
  });

  if (error) throw error;

  console.log(`[fitness] Synced from program_schedule: Week ${todayRow.week}, ${todayRow.phase}, ${todayRow.day_type}`);

  return {
    synced: true,
    skipped: false,
    current_week: todayRow.week,
    current_phase: todayRow.phase,
    timestamp,
  };
}

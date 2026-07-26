/**
 * Plan loader for weekly running analysis.
 *
 * Pulls three supplementary inputs into the synthesis prompt:
 * - This week + next week per-day schedule from Supabase `program_schedule`
 * - High-level cardio protocol markdown from Supabase `fitness_protocols` (zone HR semantics)
 *
 * Previous-week continuity lives in weekly-insights-store.getPreviousWeekInsight().
 */

import { supabase } from '@/lib/supabase';

export interface PlannedDay {
  date: string;
  dayOfWeek: string;
  week: number;
  phase: string;
  dayType: 'Training' | 'Rest';
  cardio: string;
  training: string | null;
  deload: boolean;
}

export interface WeekSchedule {
  lastWeek: PlannedDay[];
  thisWeek: PlannedDay[];
  nextWeek: PlannedDay[];
}

interface ScheduleRow {
  date: string;
  day_of_week: string;
  week: number;
  phase: string;
  day_type: 'Training' | 'Rest';
  cardio: string;
  training: string | null;
  deload: boolean;
}

function toPlannedDay(r: ScheduleRow): PlannedDay {
  return {
    date: r.date,
    dayOfWeek: r.day_of_week,
    week: r.week,
    phase: r.phase,
    dayType: r.day_type,
    cardio: r.cardio,
    training: r.training,
    deload: r.deload,
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Query Supabase program_schedule for last week + this week + next week. */
export async function loadWeekSchedule(weekStart: string, weekEnd: string): Promise<WeekSchedule> {
  const lastEnd = addDays(weekStart, -1);
  const lastStart = addDays(lastEnd, -6);
  const nextStart = addDays(weekEnd, 1);
  const nextEnd = addDays(nextStart, 6);

  const { data, error } = await supabase
    .from('program_schedule')
    .select('date, day_of_week, week, phase, day_type, cardio, training, deload')
    .gte('date', lastStart)
    .lte('date', nextEnd)
    .order('date', { ascending: true });

  if (error || !data) {
    console.warn('[plan-loader] program_schedule query failed:', error?.message);
    return { lastWeek: [], thisWeek: [], nextWeek: [] };
  }

  const rows = data as ScheduleRow[];
  const lastWeek = rows.filter((r) => r.date >= lastStart && r.date <= lastEnd).map(toPlannedDay);
  const thisWeek = rows.filter((r) => r.date >= weekStart && r.date <= weekEnd).map(toPlannedDay);
  const nextWeek = rows.filter((r) => r.date >= nextStart && r.date <= nextEnd).map(toPlannedDay);

  return { lastWeek, thisWeek, nextWeek };
}

// --- Cardio protocol loader ---

/**
 * The cardio protocol section (zone HR semantics, phase structure) used to be sliced live out of
 * a Notion page on every analysis. It now lives in Supabase `fitness_protocols` under the
 * 'cardio' key, seeded once by scripts/seed-cardio-protocol.ts and hand-edited thereafter.
 *
 * Returns '' when absent. The caller treats an empty protocol as non-fatal.
 */
export async function loadCardioProtocol(): Promise<string> {
  const { data, error } = await supabase
    .from('fitness_protocols')
    .select('content')
    .eq('protocol_key', 'cardio')
    .maybeSingle();

  if (error) {
    console.warn('[plan-loader] fitness_protocols query failed:', error.message);
    return '';
  }
  if (!data?.content) {
    console.warn('[plan-loader] no cardio protocol stored — run scripts/seed-cardio-protocol.ts');
    return '';
  }
  return data.content;
}

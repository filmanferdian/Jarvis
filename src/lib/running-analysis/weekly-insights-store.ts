/**
 * Weekly running insights, stored in Supabase `running_weekly_insights` (PK: week_start).
 *
 * Replaces the Notion Weekly Insights database. The old module had to create the database on
 * first run and cache its id in a spare sync_status column; none of that survives here.
 *
 * `weekLabel` is derived from the stored dates rather than persisted, so there is no column to
 * keep in sync and no backfill for the rows migrated out of Notion.
 */

import { supabase } from '@/lib/supabase';
import { CLAUDE_MODEL } from '@/lib/models';
import { formatWeekLabel, type WeeklyAnalysis } from './analysis-engine';

export interface WeeklyInsightEntry {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  runsLogged: number;
  totalDistanceKm: number;
  totalDurationMins: number;
  avgPacePerKm: string;
  avgHr: number | null;
  avgCadenceSpm: number | null;
  totalTrainingLoad: number;
  howWasThisWeek: string;
  whatsGood: string;
  whatNeedsWork: string;
  focusNextWeek: string;
  generatedAt: string;
}

interface InsightRow {
  week_start: string;
  week_end: string;
  runs_logged: number | null;
  total_distance_km: number | null;
  total_time_min: number | null;
  total_training_load: number | null;
  avg_hr: number | null;
  avg_cadence_spm: number | null;
  avg_pace: string | null;
  how_was_this_week: string | null;
  whats_good: string | null;
  what_needs_work: string | null;
  focus_next_week: string | null;
  generated_at: string | null;
}

const COLUMNS =
  'week_start, week_end, runs_logged, total_distance_km, total_time_min, total_training_load, ' +
  'avg_hr, avg_cadence_spm, avg_pace, how_was_this_week, whats_good, what_needs_work, ' +
  'focus_next_week, generated_at';

function toEntry(r: InsightRow): WeeklyInsightEntry {
  return {
    weekLabel: formatWeekLabel(r.week_start, r.week_end),
    weekStart: r.week_start,
    weekEnd: r.week_end,
    runsLogged: r.runs_logged ?? 0,
    totalDistanceKm: Number(r.total_distance_km ?? 0),
    totalDurationMins: Number(r.total_time_min ?? 0),
    avgPacePerKm: r.avg_pace ?? '',
    avgHr: r.avg_hr,
    avgCadenceSpm: r.avg_cadence_spm,
    totalTrainingLoad: Number(r.total_training_load ?? 0),
    howWasThisWeek: r.how_was_this_week ?? '',
    whatsGood: r.whats_good ?? '',
    whatNeedsWork: r.what_needs_work ?? '',
    focusNextWeek: r.focus_next_week ?? '',
    generatedAt: r.generated_at ?? '',
  };
}

/** All weekly insights, newest first. */
export async function getWeeklyInsights(): Promise<WeeklyInsightEntry[]> {
  const { data, error } = await supabase
    .from('running_weekly_insights')
    .select(COLUMNS)
    .order('week_start', { ascending: false });

  if (error) {
    console.warn('[weekly-insights] query failed:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as InsightRow[]).map(toEntry);
}

/**
 * The most recent insight strictly before `weekStart`, for continuity with last week's
 * "Focus Next Week". Returns null on the first run.
 */
export async function getPreviousWeekInsight(weekStart: string): Promise<WeeklyInsightEntry | null> {
  const { data, error } = await supabase
    .from('running_weekly_insights')
    .select(COLUMNS)
    .lt('week_start', weekStart)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toEntry(data as unknown as InsightRow);
}

/** Write or replace the entry for a week. */
export async function upsertWeeklyInsight(analysis: WeeklyAnalysis): Promise<void> {
  const { error } = await supabase.from('running_weekly_insights').upsert(
    {
      week_start: analysis.weekStart,
      week_end: analysis.weekEnd,
      runs_logged: analysis.runsLogged,
      total_distance_km: analysis.totalDistanceKm,
      total_time_min: analysis.totalDurationMins,
      total_training_load: analysis.totalTrainingLoad,
      avg_hr: analysis.avgHr,
      avg_cadence_spm: analysis.avgCadenceSpm,
      avg_pace: analysis.avgPacePerKm,
      how_was_this_week: analysis.howWasThisWeek,
      whats_good: analysis.whatsGood,
      what_needs_work: analysis.whatNeedsWork,
      focus_next_week: analysis.focusNextWeek,
      model: CLAUDE_MODEL,
      generated_at: analysis.generatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'week_start' },
  );

  if (error) throw new Error(`Failed to upsert weekly insight: ${error.message}`);
}

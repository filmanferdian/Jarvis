import { supabase } from '@/lib/supabase';

// Notion database ID for the Program Schedule
const FITNESS_DB_ID = process.env.NOTION_FITNESS_DB_ID;

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

// --- Notion Database Query ---

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  last_edited_time: string;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

function extractTitle(prop: unknown): string {
  const p = prop as { title?: { plain_text: string }[] };
  return p?.title?.[0]?.plain_text || '';
}

function extractSelect(prop: unknown): string | null {
  const p = prop as { select?: { name: string } };
  return p?.select?.name || null;
}

function extractDate(prop: unknown): string | null {
  const p = prop as { date?: { start: string } };
  return p?.date?.start || null;
}

function extractNumber(prop: unknown): number | null {
  const p = prop as { number?: number | null };
  return p?.number ?? null;
}

function extractRichText(prop: unknown): string {
  const p = prop as { rich_text?: { plain_text: string }[] };
  return p?.rich_text?.map((t) => t.plain_text).join('') || '';
}

function extractCheckbox(prop: unknown): boolean {
  const p = prop as { checkbox?: boolean };
  return p?.checkbox ?? false;
}

interface ScheduleRow {
  day_label: string;
  date: string;
  week: number;
  phase: string;
  day_type: string; // 'Training' | 'Rest'
  training: string;
  cardio: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  eating_open: string;
  eating_close: string;
  deload: boolean;
  steps_target: number | null;
}

function parseNotionRow(page: NotionPage): ScheduleRow {
  const p = page.properties;
  return {
    day_label: extractTitle(p['Day']),
    date: extractDate(p['Date']) || '',
    week: extractNumber(p['Week']) || 0,
    phase: extractSelect(p['Phase']) || '',
    day_type: extractSelect(p['Day Type']) || 'Rest',
    training: extractRichText(p['Training']),
    cardio: extractRichText(p['Cardio']),
    calories: extractNumber(p['Calories']) || 0,
    protein: extractNumber(p['Protein']) || 0,
    carbs: extractNumber(p['Carbs']) || 0,
    fat: extractNumber(p['Fat']) || 0,
    eating_open: extractRichText(p['Eating Open']) || '12:00',
    eating_close: extractRichText(p['Eating Close']) || '20:00',
    deload: extractCheckbox(p['Deload']),
    steps_target: extractNumber(p['Steps Target']),
  };
}

async function queryNotionDatabase(filter: Record<string, unknown>): Promise<NotionPage[]> {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey || !FITNESS_DB_ID) throw new Error('Notion credentials not configured');

  const allPages: NotionPage[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const body: Record<string, unknown> = { page_size: 100, filter };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${FITNESS_DB_ID}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion API error: ${res.status} ${err}`);
    }

    const data: NotionQueryResponse = await res.json();
    allPages.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  return allPages;
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

  if (!FITNESS_DB_ID) {
    throw new Error('NOTION_FITNESS_DB_ID not configured');
  }

  // Get today's date in WIB
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(Date.now() + wibOffset);
  const today = wibDate.toISOString().split('T')[0];

  // Query today's row from Notion database
  const todayPages = await queryNotionDatabase({
    property: 'Date',
    date: { equals: today },
  });

  if (todayPages.length === 0) {
    console.warn(`[fitness] No schedule row found for ${today}`);
    return { synced: false, skipped: true, current_week: 0, current_phase: '', timestamp };
  }

  const todayRow = parseNotionRow(todayPages[0]);

  // Check if data changed since last sync (unless forced)
  if (!force) {
    const { data: existing } = await supabase
      .from('fitness_context')
      .select('notion_last_edited, synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    if (existing?.notion_last_edited === todayPages[0].last_edited_time) {
      return { synced: false, skipped: true, current_week: todayRow.week, current_phase: todayRow.phase, timestamp };
    }
  }

  // Fetch the full week's rows to build training_day_map and cardio_schedule
  const weekPages = await queryNotionDatabase({
    property: 'Week',
    number: { equals: todayRow.week },
  });

  const weekRows = weekPages.map(parseNotionRow).sort((a, b) => a.date.localeCompare(b.date));

  // Map rows to day-of-week for training_day_map and cardio_schedule
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const trainingDayMap: Record<string, TrainingDay> = {};
  const cardioSchedule: Record<string, string> = {};

  for (const row of weekRows) {
    const d = new Date(row.date + 'T00:00:00Z');
    const dayName = dayNames[d.getUTCDay()];

    trainingDayMap[dayName] = {
      type: row.day_type === 'Training' ? (row.training || 'Training') : 'Rest',
      focus: row.day_type === 'Training' ? row.training : 'Recovery',
      exercises: [], // Exercise details not in the database — kept for interface compatibility
      total_sets: 0,
      duration: '',
    };

    cardioSchedule[dayName] = row.cardio || 'REST';
  }

  // Build macro targets from week's rows — find a training day and rest day for each macro set
  const trainingRow = weekRows.find((r) => r.day_type === 'Training') || todayRow;
  const restRow = weekRows.find((r) => r.day_type === 'Rest') || todayRow;

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

  // Determine next deload week by finding the nearest future deload row
  let nextDeloadWeek: number | null = null;
  if (!todayRow.deload) {
    const deloadPages = await queryNotionDatabase({
      and: [
        { property: 'Deload', checkbox: { equals: true } },
        { property: 'Date', date: { after: today } },
      ],
    });
    if (deloadPages.length > 0) {
      const deloadRows = deloadPages.map(parseNotionRow).sort((a, b) => a.date.localeCompare(b.date));
      nextDeloadWeek = deloadRows[0].week;
    }
  }

  // Upsert to Supabase (delete old, insert new — single row)
  await supabase.from('fitness_context').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await supabase.from('fitness_context').insert({
    current_week: todayRow.week,
    current_phase: todayRow.phase,
    phase_end_week: null, // Not tracked in per-day database
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
    notion_page_id: FITNESS_DB_ID,
    notion_last_edited: todayPages[0].last_edited_time,
    synced_at: timestamp,
  });

  if (error) throw error;

  console.log(`[fitness] Synced from Notion database: Week ${todayRow.week}, ${todayRow.phase}, ${todayRow.day_type}`);

  return {
    synced: true,
    skipped: false,
    current_week: todayRow.week,
    current_phase: todayRow.phase,
    timestamp,
  };
}

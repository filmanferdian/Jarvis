/**
 * Plan loader for weekly running analysis.
 *
 * Pulls three supplementary inputs into the synthesis prompt:
 * - This week + next week per-day schedule from Supabase `program_schedule`
 * - High-level cardio protocol markdown from Notion (for zone HR semantics)
 * - Previous week's WeeklyInsight (for continuity with last week's `Focus Next Week`)
 */

import { supabase } from '@/lib/supabase';
import { getWeeklyInsights, WeeklyInsightEntry } from './weekly-insights-db';

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

/** Query Supabase program_schedule for this week + next week. */
export async function loadWeekSchedule(weekStart: string, weekEnd: string): Promise<WeekSchedule> {
  const nextStart = addDays(weekEnd, 1);
  const nextEnd = addDays(nextStart, 6);

  const { data, error } = await supabase
    .from('program_schedule')
    .select('date, day_of_week, week, phase, day_type, cardio, training, deload')
    .gte('date', weekStart)
    .lte('date', nextEnd)
    .order('date', { ascending: true });

  if (error || !data) {
    console.warn('[plan-loader] program_schedule query failed:', error?.message);
    return { thisWeek: [], nextWeek: [] };
  }

  const rows = data as ScheduleRow[];
  const thisWeek = rows.filter((r) => r.date >= weekStart && r.date <= weekEnd).map(toPlannedDay);
  const nextWeek = rows.filter((r) => r.date >= nextStart && r.date <= nextEnd).map(toPlannedDay);

  return { thisWeek, nextWeek };
}

// --- Notion cardio protocol loader ---

const TRANSFORMATION_PROGRAM_PAGE_ID = '2f2c674aecec819dac40c78f9fb5a517';
const CARDIO_SECTION_HEADING = '5. Cardio protocol';

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': '2022-06-28',
  };
}

function extractBlockText(block: Record<string, unknown>): string {
  const type = block.type as string;
  const content = block[type] as Record<string, unknown> | undefined;
  if (!content) return '';

  const richText = content.rich_text as Array<{ plain_text: string }> | undefined;
  if (richText) {
    const text = richText.map((t) => t.plain_text).join('');
    if (type === 'heading_1') return `# ${text}`;
    if (type === 'heading_2') return `## ${text}`;
    if (type === 'heading_3') return `### ${text}`;
    if (type === 'bulleted_list_item') return `- ${text}`;
    if (type === 'numbered_list_item') return `- ${text}`;
    if (type === 'to_do') {
      const checked = (content.checked as boolean) ? '[x]' : '[ ]';
      return `- ${checked} ${text}`;
    }
    if (type === 'toggle') return `> ${text}`;
    if (type === 'quote') return `> ${text}`;
    if (type === 'callout') return `> ${text}`;
    if (type === 'divider') return '---';
    return text;
  }

  if (type === 'divider') return '---';
  return '';
}

async function fetchPageBlocks(apiKey: string, pageId: string): Promise<string[]> {
  const blocks: string[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    url.searchParams.set('page_size', '100');
    if (startCursor) url.searchParams.set('start_cursor', startCursor);

    const res = await fetch(url.toString(), { headers: notionHeaders(apiKey) });
    if (!res.ok) throw new Error(`Notion blocks ${pageId}: ${res.status}`);
    const data = await res.json();

    for (const block of data.results) {
      const text = extractBlockText(block as Record<string, unknown>);
      if (text) blocks.push(text);
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  return blocks;
}

// Memoize the protocol slice — it changes rarely. Keyed by YYYY-MM-DD.
let protocolCache: { day: string; text: string } | null = null;

/**
 * Fetch the `# 5. Cardio protocol` section from the Transformation program Notion page.
 * Returns only that section (H1 to next H1) to keep prompt tokens down.
 */
export async function loadCardioProtocol(apiKey: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  if (protocolCache && protocolCache.day === today) return protocolCache.text;

  const blocks = await fetchPageBlocks(apiKey, TRANSFORMATION_PROGRAM_PAGE_ID);

  // Slice from the cardio-protocol H1 up to the next H1.
  const startIdx = blocks.findIndex(
    (b) => b.startsWith('# ') && b.toLowerCase().includes(CARDIO_SECTION_HEADING.toLowerCase()),
  );
  if (startIdx === -1) {
    console.warn('[plan-loader] Cardio protocol section not found in Transformation program');
    return '';
  }

  let endIdx = blocks.length;
  for (let i = startIdx + 1; i < blocks.length; i++) {
    if (blocks[i].startsWith('# ')) {
      endIdx = i;
      break;
    }
  }

  const text = blocks.slice(startIdx, endIdx).join('\n');
  protocolCache = { day: today, text };
  return text;
}

// --- Previous week insight loader ---

/**
 * Find the most recent Weekly Insight with weekStart < the given date.
 * Returns null on first run or if no prior entry exists.
 */
export async function loadPreviousWeekInsight(
  apiKey: string,
  weekStart: string,
): Promise<WeeklyInsightEntry | null> {
  const all = await getWeeklyInsights(apiKey);
  const prior = all
    .filter((entry) => entry.weekStart && entry.weekStart < weekStart)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  return prior[0] ?? null;
}

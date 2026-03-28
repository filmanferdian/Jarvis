/**
 * Weekly Insights Notion database module.
 * Creates the database on first run if it doesn't exist,
 * then writes/updates weekly analysis entries.
 */

import { supabase } from '@/lib/supabase';
import { WeeklyAnalysis } from './analysis-engine';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
// Running Log page — parent for the Weekly Insights DB
const RUNNING_LOG_PAGE_ID = '32bc674aecec81c881c0dff36e8d4538';
// Cache key in sync_status for the Weekly Insights DB ID
const CACHE_KEY = 'running-weekly-insights-db-id';

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

/** Get the cached Weekly Insights DB ID from sync_status */
async function getCachedDbId(): Promise<string | null> {
  const { data } = await supabase
    .from('sync_status')
    .select('last_error')
    .eq('sync_type', CACHE_KEY)
    .single();
  return data?.last_error ?? null;
}

/** Cache the Weekly Insights DB ID in sync_status */
async function cacheDbId(dbId: string): Promise<void> {
  await supabase.from('sync_status').upsert(
    {
      sync_type: CACHE_KEY,
      last_synced_at: new Date().toISOString(),
      last_result: 'success',
      last_error: dbId,
    },
    { onConflict: 'sync_type' },
  );
}

/** Create the Weekly Insights database under the Running Log page */
async function createWeeklyInsightsDb(apiKey: string): Promise<string> {
  const body = {
    parent: { type: 'page_id', page_id: RUNNING_LOG_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Weekly Insights' } }],
    properties: {
      Week: { title: {} },
      'Week Start': { date: {} },
      'Week End': { date: {} },
      'Runs Logged': { number: { format: 'number' } },
      'Total Distance (km)': { number: { format: 'number' } },
      'Total Time (min)': { number: { format: 'number' } },
      'Avg Pace': { rich_text: {} },
      'Avg HR': { number: { format: 'number' } },
      'Total Training Load': { number: { format: 'number' } },
      'How Was This Week': { rich_text: {} },
      "What's Good": { rich_text: {} },
      'What Needs Work': { rich_text: {} },
      'Focus Next Week': { rich_text: {} },
      'Generated At': { date: {} },
    },
  };

  const res = await fetch(`${NOTION_API}/databases`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Weekly Insights DB: ${err}`);
  }

  const data = await res.json();
  return data.id;
}

/** Verify a database exists in Notion */
async function verifyDbExists(apiKey: string, dbId: string): Promise<boolean> {
  const res = await fetch(`${NOTION_API}/databases/${dbId}`, {
    headers: notionHeaders(apiKey),
  });
  return res.ok;
}

/** Get or create the Weekly Insights DB, returning its ID */
export async function getOrCreateWeeklyInsightsDb(apiKey: string): Promise<string> {
  const cached = await getCachedDbId();
  if (cached) {
    const exists = await verifyDbExists(apiKey, cached);
    if (exists) return cached;
  }

  const dbId = await createWeeklyInsightsDb(apiKey);
  await cacheDbId(dbId);
  return dbId;
}

function richText(text: string) {
  return [{ type: 'text', text: { content: text.slice(0, 2000) } }];
}

/** Find an existing Weekly Insights page for the given week */
async function findExistingInsight(
  apiKey: string,
  dbId: string,
  weekStart: string
): Promise<string | null> {
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      filter: { property: 'Week Start', date: { equals: weekStart } },
      page_size: 1,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0]?.id ?? null;
}

/** Write or update a Weekly Insights entry */
export async function upsertWeeklyInsight(apiKey: string, analysis: WeeklyAnalysis): Promise<void> {
  const dbId = await getOrCreateWeeklyInsightsDb(apiKey);

  const properties: Record<string, unknown> = {
    Week: { title: richText(analysis.weekLabel) },
    'Week Start': { date: { start: analysis.weekStart } },
    'Week End': { date: { start: analysis.weekEnd } },
    'Runs Logged': { number: analysis.runsLogged },
    'Total Distance (km)': { number: analysis.totalDistanceKm },
    'Total Time (min)': { number: analysis.totalDurationMins },
    'Avg Pace': { rich_text: richText(analysis.avgPacePerKm) },
    'Total Training Load': { number: analysis.totalTrainingLoad },
    'How Was This Week': { rich_text: richText(analysis.howWasThisWeek) },
    "What's Good": { rich_text: richText(analysis.whatsGood) },
    'What Needs Work': { rich_text: richText(analysis.whatNeedsWork) },
    'Focus Next Week': { rich_text: richText(analysis.focusNextWeek) },
    'Generated At': { date: { start: analysis.generatedAt.split('T')[0] } },
  };

  if (analysis.avgHr != null) {
    properties['Avg HR'] = { number: analysis.avgHr };
  }

  const existingId = await findExistingInsight(apiKey, dbId, analysis.weekStart);

  if (existingId) {
    // Update existing page
    const res = await fetch(`${NOTION_API}/pages/${existingId}`, {
      method: 'PATCH',
      headers: notionHeaders(apiKey),
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update Weekly Insight: ${err}`);
    }
  } else {
    // Create new page
    const res = await fetch(`${NOTION_API}/pages`, {
      method: 'POST',
      headers: notionHeaders(apiKey),
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create Weekly Insight: ${err}`);
    }
  }
}

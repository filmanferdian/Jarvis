import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Expected sync intervals in milliseconds (based on cron-job.org config)
// Intervals match cron-job.org schedule (updated 2026-04-06)
const EXPECTED_INTERVALS: Record<string, { label: string; description: string; interval_ms: number }> = {
  'google-calendar':  { label: 'Google Calendar',  description: 'Syncs personal Google Calendar events for schedule awareness',           interval_ms: 3 * 60 * 60 * 1000 },
  'outlook-calendar': { label: 'Outlook Calendar', description: 'Syncs Infinid work calendar events from Microsoft 365',                 interval_ms: 3 * 60 * 60 * 1000 },
  'garmin':           { label: 'Garmin Connect',    description: 'Pulls fitness activities, heart rate, and body composition data',        interval_ms: 6 * 60 * 60 * 1000 },
  'notion-tasks':     { label: 'Notion Tasks',      description: 'Syncs active tasks from Notion databases for task tracking',             interval_ms: 3 * 60 * 60 * 1000 },
  'email-synthesis':  { label: 'Email Synthesis',   description: 'Summarizes recent emails across Gmail and Outlook accounts',             interval_ms: 6 * 60 * 60 * 1000 },
  'email-triage':     { label: 'Email Triage',      description: 'Auto-triages work emails and drafts contextual replies',                 interval_ms: 6 * 60 * 60 * 1000 },
  'fitness':          { label: 'Fitness Context',   description: 'Generates weekly fitness summary for the morning briefing',              interval_ms: 7 * 24 * 60 * 60 * 1000 },
  'morning-briefing': { label: 'Morning Briefing',  description: 'Compiles daily briefing with calendar, tasks, and news',                 interval_ms: 24 * 60 * 60 * 1000 },
  'contact-scan':     { label: 'Contact Scanner',   description: 'Discovers and enriches professional contacts from emails',               interval_ms: 24 * 60 * 60 * 1000 },
  'news-synthesis':   { label: 'News Synthesis',    description: 'Curates personalized news digest from RSS and web sources',              interval_ms: 6 * 60 * 60 * 1000 },
  'running-analysis': { label: 'Running Analysis',  description: 'Analyzes weekly outdoor runs with pace, form, and progress insights',    interval_ms: 7 * 24 * 60 * 60 * 1000 },
};

export const GET = withAuth(async () => {
  try {
    const { data: syncRows } = await supabase
      .from('sync_status')
      .select('*')
      .order('sync_type');

    // Filter out internal-only sync types (not real integrations)
    const INTERNAL_SYNC_TYPES = ['garmin-tokens', 'garmin-circuit-breaker', 'running-weekly-insights-db-id'];
    const visibleRows = (syncRows || []).filter((row) => !INTERNAL_SYNC_TYPES.includes(row.sync_type));

    const now = Date.now();
    const integrations = visibleRows.map((row) => {
      const config = EXPECTED_INTERVALS[row.sync_type] || {
        label: row.sync_type,
        description: '',
        interval_ms: 24 * 60 * 60 * 1000,
      };

      const lastSyncTime = row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
      const elapsed = now - lastSyncTime;
      const isError = row.last_result === 'error';

      let status: 'ok' | 'warning' | 'error';
      if (lastSyncTime === 0 || elapsed > config.interval_ms * 4) {
        status = 'error';
      } else if (isError || elapsed > config.interval_ms * 2) {
        status = 'warning';
      } else {
        status = 'ok';
      }

      return {
        sync_type: row.sync_type,
        label: config.label,
        description: config.description,
        last_synced_at: row.last_synced_at,
        last_result: row.last_result,
        last_error: row.last_error,
        events_synced: row.events_synced,
        status,
        elapsed_minutes: Math.round(elapsed / 60_000),
        expected_interval_minutes: Math.round(config.interval_ms / 60_000),
      };
    });

    return NextResponse.json({
      integrations,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Integrations API error:', err);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
});

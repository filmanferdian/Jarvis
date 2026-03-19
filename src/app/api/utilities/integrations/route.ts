import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Expected sync intervals in milliseconds (based on cron-job.org config)
const EXPECTED_INTERVALS: Record<string, { label: string; interval_ms: number }> = {
  'google-calendar': { label: 'Google Calendar', interval_ms: 1 * 60 * 60 * 1000 },
  'outlook-calendar': { label: 'Outlook Calendar', interval_ms: 1 * 60 * 60 * 1000 },
  'garmin': { label: 'Garmin Connect', interval_ms: 3 * 60 * 60 * 1000 },
  'notion-tasks': { label: 'Notion Tasks', interval_ms: 3 * 60 * 60 * 1000 },
  'email-synthesis': { label: 'Email Synthesis', interval_ms: 6 * 60 * 60 * 1000 },
  'fitness': { label: 'Fitness Context', interval_ms: 7 * 24 * 60 * 60 * 1000 },
  'morning-briefing': { label: 'Morning Briefing', interval_ms: 24 * 60 * 60 * 1000 },
};

export const GET = withAuth(async () => {
  try {
    const { data: syncRows } = await supabase
      .from('sync_status')
      .select('*')
      .order('sync_type');

    const now = Date.now();
    const integrations = (syncRows || []).map((row) => {
      const config = EXPECTED_INTERVALS[row.sync_type] || {
        label: row.sync_type,
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
    return NextResponse.json({ error: 'Failed to fetch integrations', details: String(err) }, { status: 500 });
  }
});

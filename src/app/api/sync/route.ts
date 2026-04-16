import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { shouldSync, markSynced } from '@/lib/syncTracker';
import { syncGoogleCalendar } from '@/lib/sync/googleCalendar';
import { syncOutlookCalendar } from '@/lib/sync/outlookCalendar';
import { syncNotionTasks } from '@/lib/sync/notionTasks';
import { syncFitness } from '@/lib/sync/fitness';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

// POST: Trigger stale syncs on dashboard load (debounced)
export const POST = withAuth(async (_req: NextRequest) => {
  const results: Record<string, string> = {};

  // Google Calendar — 15 min interval
  if (await shouldSync('google-calendar', FIFTEEN_MINUTES)) {
    try {
      const r = await syncGoogleCalendar();
      await markSynced('google-calendar', 'success', r.synced);
      results['google-calendar'] = `synced ${r.synced} events`;
    } catch (err) {
      await markSynced('google-calendar', 'error', 0, String(err));
      console.error('[sync] google-calendar error:', err);
      results['google-calendar'] = 'error';
    }
  } else {
    results['google-calendar'] = 'skipped (recent)';
  }

  // Outlook Calendar — 15 min interval
  if (await shouldSync('outlook-calendar', FIFTEEN_MINUTES)) {
    try {
      const r = await syncOutlookCalendar();
      await markSynced('outlook-calendar', 'success', r.synced);
      results['outlook-calendar'] = `synced ${r.synced} events`;
    } catch (err) {
      await markSynced('outlook-calendar', 'error', 0, String(err));
      console.error('[sync] outlook-calendar error:', err);
      results['outlook-calendar'] = 'error';
    }
  } else {
    results['outlook-calendar'] = 'skipped (recent)';
  }

  // Notion Tasks — 30 min interval
  if (await shouldSync('notion-tasks', THIRTY_MINUTES)) {
    try {
      const r = await syncNotionTasks();
      await markSynced('notion-tasks', 'success', r.synced);
      results['notion-tasks'] = `synced ${r.synced} tasks`;
    } catch (err) {
      await markSynced('notion-tasks', 'error', 0, String(err));
      console.error('[sync] notion-tasks error:', err);
      results['notion-tasks'] = 'error';
    }
  } else {
    results['notion-tasks'] = 'skipped (recent)';
  }

  // Fitness Context — 6 hour interval
  if (await shouldSync('fitness', SIX_HOURS)) {
    try {
      const r = await syncFitness();
      await markSynced('fitness', 'success', r.synced ? 1 : 0);
      results['fitness'] = r.skipped ? 'skipped (no changes)' : `synced week ${r.current_week}`;
    } catch (err) {
      await markSynced('fitness', 'error', 0, String(err));
      console.error('[sync] fitness error:', err);
      results['fitness'] = 'error';
    }
  } else {
    results['fitness'] = 'skipped (recent)';
  }

  return NextResponse.json({
    results,
    timestamp: new Date().toISOString(),
  });
});

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncOutlookCalendar } from '@/lib/sync/outlookCalendar';
import { markSynced } from '@/lib/syncTracker';
import { logCronRun } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const start = Date.now();
  try {
    const result = await syncOutlookCalendar();
    const duration = Date.now() - start;
    await markSynced('outlook-calendar', 'success', result.synced);
    await logCronRun('outlook-calendar', 'success', `synced ${result.synced} events`, duration);
    return NextResponse.json(result);
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Cron: Outlook sync error:', msg);
    await markSynced('outlook-calendar', 'error', 0, msg.slice(0, 500));
    await logCronRun('outlook-calendar', 'error', msg.slice(0, 500), duration);
    return NextResponse.json(
      { error: 'Outlook sync failed', details: msg },
      { status: 500 },
    );
  }
});

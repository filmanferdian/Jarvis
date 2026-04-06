import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncGoogleCalendar } from '@/lib/sync/googleCalendar';
import { markSynced } from '@/lib/syncTracker';
import { logCronRun } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const start = Date.now();
  try {
    const result = await syncGoogleCalendar();
    const duration = Date.now() - start;
    await markSynced('google-calendar', 'success', result.synced);
    await logCronRun('google-calendar', 'success', `synced ${result.synced} events`, duration);
    return NextResponse.json(result);
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Cron: Google Calendar sync error:', msg);
    await markSynced('google-calendar', 'error', 0, msg.slice(0, 500));
    await logCronRun('google-calendar', 'error', msg.slice(0, 500), duration);
    return NextResponse.json(
      { error: 'Google Calendar sync failed', details: msg },
      { status: 500 },
    );
  }
});

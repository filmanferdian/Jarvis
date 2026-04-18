import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncGarmin } from '@/lib/sync/garmin';
import { markSynced } from '@/lib/syncTracker';
import { logCronRun } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const start = Date.now();
  try {
    const result = await syncGarmin();
    const duration = Date.now() - start;

    // If circuit breaker blocked the sync, return 200 with skip info (not 500)
    if (result.skipped) {
      await markSynced('garmin', 'success', 0, `skipped: ${result.skipReason}`);
      await logCronRun('garmin', 'success', `skipped: ${result.skipReason}`, duration);
      return NextResponse.json({ skipped: true, reason: result.skipReason, timestamp: result.timestamp });
    }

    await markSynced('garmin', 'success', result.activitiesSynced);
    await logCronRun('garmin', 'success', `synced ${result.activitiesSynced} activities`, duration);
    return NextResponse.json(result);
  } catch (err) {
    const duration = Date.now() - start;
    const errorMsg = err instanceof Error
      ? `${err.message}${err.stack ? '\n' + err.stack.split('\n').slice(1, 3).join('\n') : ''}`
      : typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.error('Cron: Garmin sync error:', errorMsg);

    // If blocked, return 200 to prevent cron-job.org from retrying
    const errStr = err instanceof Error ? err.message : typeof err === 'object' ? JSON.stringify(err) : String(err);
    if (errStr.includes('blocked') || errStr.includes('budget exceeded')) {
      await markSynced('garmin', 'success', 0, `skipped: ${errStr.slice(0, 500)}`);
      await logCronRun('garmin', 'success', `skipped: ${errStr.slice(0, 500)}`, duration);
      return NextResponse.json({ skipped: true, reason: errStr.slice(0, 500) });
    }

    await markSynced('garmin', 'error', 0, errStr.slice(0, 500));
    await logCronRun('garmin', 'error', errStr.slice(0, 500), duration);
    return NextResponse.json(
      { error: 'Garmin sync failed', details: errStr },
      { status: 500 },
    );
  }
});

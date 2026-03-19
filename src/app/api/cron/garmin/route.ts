import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncGarmin } from '@/lib/sync/garmin';
import { markSynced } from '@/lib/syncTracker';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncGarmin();
    await markSynced('garmin', 'success', result.activitiesSynced);
    return NextResponse.json(result);
  } catch (err) {
    const errorMsg = err instanceof Error
      ? `${err.message}${err.stack ? '\n' + err.stack.split('\n').slice(1, 3).join('\n') : ''}`
      : String(err);
    console.error('Cron: Garmin sync error:', errorMsg);
    await markSynced('garmin', 'error', 0, String(err).slice(0, 500));
    return NextResponse.json(
      { error: 'Garmin sync failed', details: String(err) },
      { status: 500 },
    );
  }
});

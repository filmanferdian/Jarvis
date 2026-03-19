import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncFitness } from '@/lib/sync/fitness';
import { markSynced } from '@/lib/syncTracker';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncFitness(true);
    await markSynced('fitness', 'success', result.synced ? 1 : 0);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Fitness sync error:', err);
    await markSynced('fitness', 'error', 0, String(err));
    return NextResponse.json(
      { error: 'Fitness sync failed', details: String(err) },
      { status: 500 },
    );
  }
});

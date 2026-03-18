import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncGarmin } from '@/lib/sync/garmin';

// POST: Manually trigger Garmin sync
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncGarmin();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Garmin sync error:', err);
    const message = err instanceof Error ? err.message : typeof err === 'object' ? JSON.stringify(err) : String(err);
    return NextResponse.json(
      { error: 'Garmin sync failed', details: message },
      { status: 500 },
    );
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncGarmin, isGarminBlocked } from '@/lib/sync/garmin';

// POST: Manually trigger Garmin sync
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncGarmin();
    if (result.skipped) {
      return NextResponse.json({ skipped: true, reason: result.skipReason, timestamp: result.timestamp });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('Garmin sync error:', err);
    const message = err instanceof Error ? err.message : typeof err === 'object' ? JSON.stringify(err) : String(err);

    if (message.includes('blocked') || message.includes('budget exceeded')) {
      return NextResponse.json({ skipped: true, reason: message });
    }

    return NextResponse.json(
      { error: 'Garmin sync failed', details: message },
      { status: 500 },
    );
  }
});

// GET: Check circuit breaker status
export const GET = withAuth(async () => {
  const status = await isGarminBlocked();
  return NextResponse.json(status);
});

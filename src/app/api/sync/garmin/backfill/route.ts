import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { backfillGarmin } from '@/lib/sync/garmin';

// POST: Trigger 56-day Garmin backfill (one-time, auth-protected)
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await backfillGarmin();
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Garmin backfill error:', err);
    return NextResponse.json(
      { error: 'Backfill failed', details: String(err) },
      { status: 500 },
    );
  }
});

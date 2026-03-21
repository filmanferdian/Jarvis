import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { backfillGarmin } from '@/lib/sync/garmin';

// POST: Trigger 56-day Garmin backfill (auth-protected)
// Query params: ?force=true to re-fetch all dates from API
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const force = req.nextUrl.searchParams.get('force') === 'true';
    const result = await backfillGarmin(force);

    if (result.skipped) {
      return NextResponse.json({ skipped: true, reason: result.skipReason, timestamp: new Date().toISOString() });
    }

    return NextResponse.json({
      ...result,
      force,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Garmin backfill error:', err);
    const message = String(err);

    if (message.includes('blocked') || message.includes('budget exceeded')) {
      return NextResponse.json({ skipped: true, reason: message });
    }

    return NextResponse.json(
      { error: 'Backfill failed', details: message },
      { status: 500 },
    );
  }
});

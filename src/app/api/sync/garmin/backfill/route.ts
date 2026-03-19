import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { backfillGarmin } from '@/lib/sync/garmin';

// POST: Trigger 56-day Garmin backfill (auth-protected)
// Query params: ?force=true to re-fetch all dates from API
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const force = req.nextUrl.searchParams.get('force') === 'true';
    const result = await backfillGarmin(force);
    return NextResponse.json({
      ...result,
      force,
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

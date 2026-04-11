import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { withCronAuth } from '@/lib/cronAuth';
import { backfillGarmin, backfillDateRange } from '@/lib/sync/garmin';

// Accept either browser auth (cookie/bearer) or cron auth (x-cron-secret)
function withEitherAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    if (req.headers.get('x-cron-secret')) {
      return withCronAuth(handler)(req);
    }
    return withAuth(handler)(req);
  };
}

// POST: Trigger Garmin backfill (auth-protected)
// Query params:
//   ?force=true — re-fetch all dates from API (56-day window)
//   ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — fetch specific date range
export const POST = withEitherAuth(async (req: NextRequest) => {
  try {
    const startDate = req.nextUrl.searchParams.get('startDate');
    const endDate = req.nextUrl.searchParams.get('endDate');

    // Date range mode: fetch specific dates (bypasses 56-day limit)
    // Add &computeBaseline=true to average the data and write to okr_targets
    if (startDate && endDate) {
      const computeBaseline = req.nextUrl.searchParams.get('computeBaseline') === 'true';
      const result = await backfillDateRange(startDate, endDate, computeBaseline);

      if (result.skipped) {
        return NextResponse.json({ skipped: true, reason: result.skipReason, timestamp: new Date().toISOString() });
      }

      return NextResponse.json({
        ...result,
        startDate,
        endDate,
        timestamp: new Date().toISOString(),
      });
    }

    // Standard 56-day backfill
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

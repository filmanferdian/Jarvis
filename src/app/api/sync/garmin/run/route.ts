import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncGarmin } from '@/lib/sync/garmin';
import { safeError } from '@/lib/errors';

// GET: Trigger Garmin sync from a browser (ad-hoc, mobile-friendly).
// Uses the signed-in cookie, so just open the URL while logged in.
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncGarmin();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('blocked') || msg.includes('budget exceeded')) {
      return NextResponse.json({ skipped: true, reason: msg });
    }
    return safeError('Garmin sync failed', err);
  }
});

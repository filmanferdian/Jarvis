import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncGarmin } from '@/lib/sync/garmin';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncGarmin();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Garmin sync error:', err);
    return NextResponse.json(
      { error: 'Garmin sync failed', details: String(err) },
      { status: 500 },
    );
  }
});

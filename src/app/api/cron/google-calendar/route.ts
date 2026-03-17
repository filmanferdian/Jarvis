import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncGoogleCalendar } from '@/lib/sync/googleCalendar';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncGoogleCalendar();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Google Calendar sync error:', err);
    return NextResponse.json(
      { error: 'Google Calendar sync failed', details: String(err) },
      { status: 500 },
    );
  }
});

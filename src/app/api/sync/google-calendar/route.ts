import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncGoogleCalendar } from '@/lib/sync/googleCalendar';

// POST: Sync today's Google Calendar events to Supabase
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncGoogleCalendar();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('NO_GOOGLE_TOKENS')) {
      return NextResponse.json(
        { error: 'Google auth required', authUrl: '/api/auth/google' },
        { status: 401 },
      );
    }
    console.error('Google Calendar sync error:', err);
    return NextResponse.json(
      { error: 'Google Calendar sync failed', details: message },
      { status: 500 },
    );
  }
});

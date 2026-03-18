import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncOutlookCalendar } from '@/lib/sync/outlookCalendar';

// POST: Sync today's Outlook calendar events to Supabase
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncOutlookCalendar();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'NO_TOKENS' || message.includes('refresh failed')) {
      return NextResponse.json(
        { error: 'Microsoft auth required', authUrl: '/api/auth/microsoft' },
        { status: 401 },
      );
    }
    console.error('[API Error] Outlook sync failed:', err);
    return NextResponse.json(
      { error: 'Outlook sync failed', details: message },
      { status: 500 },
    );
  }
});

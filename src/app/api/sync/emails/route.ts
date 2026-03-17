import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncEmails } from '@/lib/sync/emailSynthesis';

// POST: Fetch emails from all connected inboxes, synthesize with Claude, save to Supabase
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncEmails();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Daily API limit reached') {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    console.error('Email sync error:', err);
    return NextResponse.json(
      { error: 'Email sync failed', details: message },
      { status: 500 },
    );
  }
});

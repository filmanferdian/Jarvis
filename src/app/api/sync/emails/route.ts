import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncEmails } from '@/lib/sync/emailSynthesis';

// POST: Fetch emails from all connected inboxes, synthesize with Claude, save to Supabase
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncEmails();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[API Error] Email sync failed:', err);
    return NextResponse.json(
      { error: 'Email sync failed' },
      { status: 500 },
    );
  }
});

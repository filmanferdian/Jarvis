import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncEmails } from '@/lib/sync/emailSynthesis';
import { markSynced } from '@/lib/syncTracker';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncEmails();
    await markSynced('email-synthesis', 'success');
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Email synthesis error:', err);
    await markSynced('email-synthesis', 'error', 0, String(err).slice(0, 500));
    return NextResponse.json(
      { error: 'Email synthesis failed', details: String(err) },
      { status: 500 },
    );
  }
});

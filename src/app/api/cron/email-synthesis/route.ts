import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncEmails } from '@/lib/sync/emailSynthesis';
import { markSynced } from '@/lib/syncTracker';
import { logCronRun } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const start = Date.now();
  try {
    const result = await syncEmails();
    const duration = Date.now() - start;
    await markSynced('email-synthesis', 'success');
    await logCronRun('email-synthesis', 'success', `synced ${result.emailCount ?? 0} emails`, duration);
    return NextResponse.json(result);
  } catch (err) {
    const duration = Date.now() - start;
    console.error('Cron: Email synthesis error:', err);
    await markSynced('email-synthesis', 'error', 0, String(err).slice(0, 500));
    await logCronRun('email-synthesis', 'error', String(err).slice(0, 500), duration);
    return NextResponse.json(
      { error: 'Email synthesis failed', details: String(err) },
      { status: 500 },
    );
  }
});

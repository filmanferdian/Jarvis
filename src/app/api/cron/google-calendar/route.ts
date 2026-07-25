import { NextRequest, NextResponse, after } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncGoogleCalendar } from '@/lib/sync/googleCalendar';
import { markSynced } from '@/lib/syncTracker';
import { logCronRun } from '@/lib/cronLog';
import { maybeCaptureAiInsights } from '@/lib/learningsSchedule';

// This job also hosts the weekly Learnings capture. It is the most frequent and
// most reliable registered job (42 runs, 42 successes over 7 days) and it fires
// at 07:00 WIB daily, so gating the capture to Sunday lands it at Sunday 07:00
// without adding anything to the external scheduler by hand.
//
// The capture runs in after(), so it cannot add latency to this response or
// change this job's success or failure. maybeCaptureAiInsights never throws.

export const maxDuration = 120;

export const GET = withCronAuth(async (_req: NextRequest) => {
  const start = Date.now();
  after(() => maybeCaptureAiInsights());
  try {
    const result = await syncGoogleCalendar();
    const duration = Date.now() - start;
    await markSynced('google-calendar', 'success', result.synced);
    await logCronRun('google-calendar', 'success', `synced ${result.synced} events`, duration);
    return NextResponse.json(result);
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Cron: Google Calendar sync error:', msg);
    await markSynced('google-calendar', 'error', 0, msg.slice(0, 500));
    await logCronRun('google-calendar', 'error', msg.slice(0, 500), duration);
    return NextResponse.json(
      { error: 'Google Calendar sync failed', details: msg },
      { status: 500 },
    );
  }
});

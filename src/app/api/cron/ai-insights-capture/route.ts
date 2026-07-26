import { NextRequest, NextResponse, after } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { runCronJob } from '@/lib/cronLog';
import { captureAiInsights, alreadyCapturedThisWeek, wibWeekStart } from '@/lib/sync/aiInsightsCapture';

// Weekly raw capture for the Learnings page. This route is the ONLY entry point.
//
// It has its own cron-job.org job: Sunday 07:00 WIB (Asia/Jakarta), matching the
// Claude Code ranking task that reads what this banks. It used to ride the
// google-calendar cron behind a self-gate, which failed silently on 2026-07-26
// because that gate shared one sync_status row with this route's on-demand runs.
// A dedicated schedule removes both the shared state and the hidden coupling: if
// this job stops running, cron-job.org shows a failed job instead of nothing.
//
// Returns 202 immediately and works in the background: Reddit's serialized
// backoff alone can exceed the external scheduler's 30s HTTP timeout, so the
// scheduler must not be made to wait for the result.
//
// Re-running inside the same week is a no-op unless ?force=1. Use force to
// re-bank a week deliberately, for example after fixing a broken source.

export const maxDuration = 120;

// No social flag on purpose. This module is fetch-only, and the Nitter mirror
// refuses Node fetch on EVERY machine (200 with an empty body locally,
// connection failure from Railway). curl is the only transport that reaches it
// and Railway has no curl, so X can never be captured through this route.
// X items come from scripts/ai-insights-fetch.mjs, run by the local scheduled
// task, which upserts on top of whatever was banked here.
export const GET = withCronAuth(async (req: NextRequest) => {
  const force = req.nextUrl.searchParams.get('force') === '1';
  const weekStart = wibWeekStart();

  if (!force && (await alreadyCapturedThisWeek(weekStart))) {
    return NextResponse.json({ skipped: 'already captured this week', weekStart });
  }

  after(async () => {
    const r = await runCronJob('ai-insights-capture', () => captureAiInsights({ includeSocial: false, ranFrom: 'railway' }), {
      itemsCount: (d) => d.inserted,
      message: (d) =>
        `captured ${d.inserted} items, ${d.sourcesOk.length} sources ok` +
        (d.sourcesFailed.length ? `, failed: ${d.sourcesFailed.join(', ')}` : ''),
    });
    if (!r.ok) console.error('[cron:ai-insights-capture]', r.error);
  });

  return NextResponse.json({ accepted: true, weekStart }, { status: 202 });
});

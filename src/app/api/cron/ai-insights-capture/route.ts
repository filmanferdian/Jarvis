import { NextRequest, NextResponse, after } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { runCronJob } from '@/lib/cronLog';
import { captureAiInsights } from '@/lib/sync/aiInsightsCapture';

// Standalone weekly capture for the Learnings page.
//
// In normal operation this route is NOT scheduled. The capture rides the
// google-calendar cron via maybeCaptureAiInsights() in src/lib/learningsSchedule.ts,
// which avoids adding a job to the external scheduler by hand. This route exists
// so the capture can be triggered on demand, and so a dedicated schedule can be
// pointed at it later without any code change.
//
// Returns 202 immediately and works in the background: Reddit's serialized
// backoff alone can exceed the external scheduler's 30s HTTP timeout.

export const maxDuration = 120;

// No social flag on purpose. This module is fetch-only, and the Nitter mirror
// refuses Node fetch on EVERY machine (200 with an empty body locally,
// connection failure from Railway). curl is the only transport that reaches it
// and Railway has no curl, so X can never be captured through this route.
// X items come from scripts/ai-insights-fetch.mjs, run by the local scheduled
// task, which upserts on top of whatever was banked here.
export const GET = withCronAuth(async (_req: NextRequest) => {
  after(async () => {
    const r = await runCronJob('ai-insights-capture', () => captureAiInsights({ includeSocial: false, ranFrom: 'railway' }), {
      itemsCount: (d) => d.inserted,
      message: (d) =>
        `captured ${d.inserted} items, ${d.sourcesOk.length} sources ok` +
        (d.sourcesFailed.length ? `, failed: ${d.sourcesFailed.join(', ')}` : ''),
    });
    if (!r.ok) console.error('[cron:ai-insights-capture]', r.error);
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
});

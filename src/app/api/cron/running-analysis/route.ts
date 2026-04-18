import { NextRequest, NextResponse, after } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { runRunningAnalysis } from '@/lib/running-analysis';
import { runCronJob } from '@/lib/cronLog';

export const maxDuration = 120;

// GET: Cron trigger — runs every Saturday at 12pm WIB (05:00 UTC)
// Analyzes Mon–today of the current week's outdoor running data.
// Returns 202 immediately and runs the analysis via `after()` so cron-job.org's
// 30s HTTP timeout doesn't report a false failure.
export const GET = withCronAuth(async (_req: NextRequest) => {
  after(async () => {
    const r = await runCronJob('running-analysis', () => runRunningAnalysis(), {
      itemsCount: (d) => d.activitiesIngested,
      message: (d) =>
        `week ${d.weekStart}–${d.weekEnd}: found ${d.activitiesFound}, ingested ${d.activitiesIngested}, skipped ${d.activitiesSkipped}, analysis=${d.analysisGenerated}`,
    });
    if (r.ok && r.data.errors.length > 0) {
      console.warn('[cron:running-analysis] Errors:', r.data.errors);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
});

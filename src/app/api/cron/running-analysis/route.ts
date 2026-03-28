import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { runRunningAnalysis } from '@/lib/running-analysis';
import { markSynced } from '@/lib/syncTracker';

// GET: Cron trigger — runs every Monday at 6am WIB (Sunday 23:00 UTC)
// Analyzes the previous Mon–Sun week's outdoor running data.
export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await runRunningAnalysis();

    await markSynced('running-analysis', 'success', result.activitiesIngested);

    console.log(
      `[cron:running-analysis] Done. Week: ${result.weekStart}–${result.weekEnd}, ` +
      `found: ${result.activitiesFound}, ingested: ${result.activitiesIngested}, ` +
      `skipped: ${result.activitiesSkipped}, analysis: ${result.analysisGenerated}`
    );

    if (result.errors.length > 0) {
      console.warn('[cron:running-analysis] Errors:', result.errors);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron:running-analysis] Fatal error:', message);
    await markSynced('running-analysis', 'error', 0, message.slice(0, 500));
    return NextResponse.json({ error: 'Running analysis failed', details: message }, { status: 500 });
  }
});

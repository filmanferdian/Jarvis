import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { runRunningAnalysis } from '@/lib/running-analysis';
import { markSynced } from '@/lib/syncTracker';
import { safeError } from '@/lib/errors';

// GET: Trigger running analysis from a mobile browser.
// Uses the signed-in cookie — open the URL and wait.
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const result = await runRunningAnalysis({});
    await markSynced('running-analysis', 'success', result.activitiesIngested);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markSynced('running-analysis', 'error', 0, message.slice(0, 500));
    return safeError('Running analysis failed', err);
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { withCronAuth } from '@/lib/cronAuth';
import { runRunningAnalysis } from '@/lib/running-analysis';
import { markSynced } from '@/lib/syncTracker';

// POST: Manually trigger running analysis
// Body params (all optional):
//   date: string (YYYY-MM-DD) — analyze the week containing this date; defaults to previous week
//   analysis_only: boolean — skip data ingestion, only run analysis
//   force_resync: boolean — re-ingest even if Garmin ID already in Notion
export const POST = withCronAuth(async (req: NextRequest) => {
  try {
    let date: string | undefined;
    let analysisOnly = false;
    let forceResync = false;

    try {
      const body = await req.json();
      date = body.date;
      analysisOnly = !!body.analysis_only;
      forceResync = !!body.force_resync;
    } catch {
      // No body or invalid JSON — use defaults
    }

    const result = await runRunningAnalysis({ date, analysisOnly, forceResync });

    await markSynced('running-analysis', 'success', result.activitiesIngested);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] Running analysis error:', message);
    await markSynced('running-analysis', 'error', 0, message.slice(0, 500));
    return NextResponse.json({ error: 'Running analysis failed', details: message }, { status: 500 });
  }
});

// GET: Status of last running analysis run
export const GET = withAuth(async () => {
  try {
    const { supabase } = await import('@/lib/supabase');

    const { data } = await supabase
      .from('sync_status')
      .select('last_synced_at, last_result, last_error, events_synced')
      .eq('sync_type', 'running-analysis')
      .single();

    return NextResponse.json({
      lastRun: data?.last_synced_at ?? null,
      lastResult: data?.last_result ?? null,
      lastError: data?.last_error ?? null,
      recordsSynced: data?.events_synced ?? 0,
    });
  } catch {
    return NextResponse.json({ lastRun: null, lastResult: null, lastError: null, recordsSynced: 0 });
  }
});

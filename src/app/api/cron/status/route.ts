import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Return last run status for each cron job
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Get the most recent run for each job using distinct on
    const { data, error } = await supabase
      .from('cron_run_log')
      .select('job_name, status, message, duration_ms, ran_at')
      .order('ran_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Group by job name, take latest entry
    const jobStatus: Record<string, {
      lastRun: string;
      status: string;
      message: string | null;
      durationMs: number | null;
    }> = {};

    for (const row of data ?? []) {
      if (!jobStatus[row.job_name]) {
        jobStatus[row.job_name] = {
          lastRun: row.ran_at,
          status: row.status,
          message: row.message,
          durationMs: row.duration_ms,
        };
      }
    }

    return NextResponse.json({ jobs: jobStatus });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch cron status' },
      { status: 500 },
    );
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncCareerJobs } from '@/lib/sync/careerJobWatch';
import { safeError } from '@/lib/errors';

// Browser-triggered on-demand refresh (same pipeline as the Tue/Thu cron).
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncCareerJobs();
    return NextResponse.json(result);
  } catch (err) {
    return safeError('Career refresh failed', err);
  }
});

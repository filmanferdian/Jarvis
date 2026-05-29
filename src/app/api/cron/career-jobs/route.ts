import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncCareerJobs } from '@/lib/sync/careerJobWatch';
import { runCronJob } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const r = await runCronJob('career-jobs', () => syncCareerJobs(), {
    itemsCount: (d) => d.scored,
    message: (d) =>
      `kept ${d.kept}, scored ${d.scored}, closed ${d.closed}` +
      (d.errors ? `; ${d.errors.length} errors` : ''),
  });
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: 'Career job watch failed' }, { status: 500 });
});

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncFitness } from '@/lib/sync/fitness';
import { runCronJob } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const r = await runCronJob('fitness', () => syncFitness(true), {
    itemsCount: (d) => (d.synced ? 1 : 0),
  });
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: 'Fitness sync failed' }, { status: 500 });
});

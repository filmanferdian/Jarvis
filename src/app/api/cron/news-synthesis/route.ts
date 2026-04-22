import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncNews } from '@/lib/sync/newsSynthesis';
import { runCronJob } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const r = await runCronJob('news-synthesis', () => syncNews(), {
    itemsCount: (d) => d.email.count + d.indonesia.count + d.international.count,
  });
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: 'News synthesis failed' }, { status: 500 });
});

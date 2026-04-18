import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { generateBriefing } from '@/lib/sync/morningBriefing';
import { runCronJob } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const r = await runCronJob('morning-briefing', () => generateBriefing());
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: 'Morning briefing failed' }, { status: 500 });
});

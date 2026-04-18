import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncNotionContext } from '@/lib/sync/notionContext';
import { runCronJob } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const r = await runCronJob('notion-context', () => syncNotionContext());
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: 'Notion context sync failed' }, { status: 500 });
});

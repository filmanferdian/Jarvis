import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncInvestmentQuotes } from '@/lib/sync/investmentQuotes';
import { runCronJob } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const r = await runCronJob('investment-quotes', () => syncInvestmentQuotes(), {
    itemsCount: (d) => d.priced,
    message: (d) => `priced ${d.priced} of ${d.fetched}`,
  });
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: 'Investment quote refresh failed' }, { status: 500 });
});

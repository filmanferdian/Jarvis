import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { safeError } from '@/lib/errors';
import { listValuations, getMemoForTicker, clearValuationCaches } from '@/lib/investments/valuation';
import { getStoredQuotes } from '@/lib/sync/investmentQuotes';

export const GET = withAuth(async (req: NextRequest) => {
  const ticker = req.nextUrl.searchParams.get('ticker');
  const wantQuotes = req.nextUrl.searchParams.get('quotes');
  const refresh = req.nextUrl.searchParams.get('refresh');

  try {
    // Manual refresh: drop the day-keyed cache so the next read re-queries Notion.
    if (refresh) clearValuationCaches();

    if (ticker) {
      const memo = await getMemoForTicker(ticker);
      return NextResponse.json(memo);
    }

    if (wantQuotes) {
      const { quotes, asOf } = await getStoredQuotes();
      return NextResponse.json({ quotes, asOf });
    }

    const valuations = await listValuations();
    return NextResponse.json({ valuations });
  } catch (err) {
    return safeError('Failed to load investment data', err);
  }
});

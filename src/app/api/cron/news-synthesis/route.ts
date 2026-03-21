import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncNews } from '@/lib/sync/newsSynthesis';
import { markSynced } from '@/lib/syncTracker';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncNews();
    await markSynced('news-synthesis', 'success', result.emailCount);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: News synthesis error:', err);
    await markSynced('news-synthesis', 'error', 0, String(err).slice(0, 500));
    return NextResponse.json(
      { error: 'News synthesis failed', details: String(err) },
      { status: 500 },
    );
  }
});

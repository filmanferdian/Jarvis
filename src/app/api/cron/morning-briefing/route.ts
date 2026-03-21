import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { generateBriefing } from '@/lib/sync/morningBriefing';
import { markSynced } from '@/lib/syncTracker';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await generateBriefing();
    await markSynced('morning-briefing', 'success');
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Morning briefing error:', err);
    await markSynced('morning-briefing', 'error', 0, String(err).slice(0, 500));
    return NextResponse.json(
      { error: 'Morning briefing failed', details: String(err) },
      { status: 500 },
    );
  }
});

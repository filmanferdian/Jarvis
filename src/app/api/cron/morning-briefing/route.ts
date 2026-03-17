import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { generateBriefing } from '@/lib/sync/morningBriefing';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await generateBriefing();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Morning briefing error:', err);
    return NextResponse.json(
      { error: 'Morning briefing failed', details: String(err) },
      { status: 500 },
    );
  }
});

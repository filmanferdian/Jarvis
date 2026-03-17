import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { generateBriefing } from '@/lib/sync/morningBriefing';

// POST: Regenerate today's morning briefing using real calendar + tasks data
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await generateBriefing();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Daily API limit reached') {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    return NextResponse.json(
      { error: 'Failed to regenerate briefing', details: message },
      { status: 500 }
    );
  }
});

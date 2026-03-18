import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncFitness } from '@/lib/sync/fitness';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';

// POST: Sync transformation program from Notion → fitness_context
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', usage },
        { status: 429 }
      );
    }

    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';

    const result = await syncFitness(force);

    if (result.synced) {
      await incrementUsage();
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API Error] Fitness sync failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Fitness sync failed', details: message },
      { status: 500 }
    );
  }
});

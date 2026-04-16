import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncNotionContext } from '@/lib/sync/notionContext';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncNotionContext();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Notion context sync error:', err);
    return NextResponse.json(
      { error: 'Notion context sync failed' },
      { status: 500 },
    );
  }
});

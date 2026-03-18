import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncNotionTasks } from '@/lib/sync/notionTasks';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncNotionTasks();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Notion sync error:', err);
    return NextResponse.json(
      { error: 'Notion sync failed', details: String(err) },
      { status: 500 },
    );
  }
});

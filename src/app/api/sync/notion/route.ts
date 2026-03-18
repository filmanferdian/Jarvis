import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncNotionTasks } from '@/lib/sync/notionTasks';

// POST: Sync all tasks from Notion to local Supabase cache
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const result = await syncNotionTasks();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[API Error] Notion sync failed:', err);
    return NextResponse.json(
      { error: 'Notion sync failed' },
      { status: 500 }
    );
  }
});

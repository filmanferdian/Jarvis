import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncNotionTasks } from '@/lib/sync/notionTasks';
import { markSynced } from '@/lib/syncTracker';
import { logCronRun } from '@/lib/cronLog';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const start = Date.now();
  try {
    const result = await syncNotionTasks();
    const duration = Date.now() - start;
    await markSynced('notion-tasks', 'success', result.synced);
    await logCronRun('notion-tasks', 'success', `synced ${result.synced} tasks`, duration);
    return NextResponse.json(result);
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Cron: Notion sync error:', msg);
    await markSynced('notion-tasks', 'error', 0, msg.slice(0, 500));
    await logCronRun('notion-tasks', 'error', msg.slice(0, 500), duration);
    return NextResponse.json(
      { error: 'Notion sync failed', details: msg },
      { status: 500 },
    );
  }
});

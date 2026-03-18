import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Fetch Notion tasks (due today or this week, ordered by priority)
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Use WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    // End of this week (Sunday)
    const dayOfWeek = wibDate.getDay();
    const endOfWeek = new Date(wibDate);
    endOfWeek.setDate(wibDate.getDate() + (7 - dayOfWeek));
    const weekEnd = endOfWeek.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('notion_tasks')
      .select('*')
      .lte('due_date', weekEnd)
      .not('status', 'in', '("Done","Archived")')
      .order('due_date', { ascending: true });

    if (error) throw error;

    // Filter out obsolete/test tasks that haven't been archived in Notion
    const TASK_BLACKLIST = [
      'create performance marketing plan',
      'create social media plan',
      'test task from jarvis',
    ];
    const filtered = (data ?? []).filter(
      (t: { name?: string }) => !TASK_BLACKLIST.some(
        (b) => (t.name || '').toLowerCase().includes(b)
      )
    );

    return NextResponse.json({
      date: today,
      tasks: filtered,
      count: filtered.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
});

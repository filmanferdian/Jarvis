import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const STATUS_CYCLE = ['Not Started', 'In Progress', 'Done'];

// PATCH: Update task status (cycles through statuses) in Notion + local cache
export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const { notionPageId, status } = await req.json();

    if (!notionPageId) {
      return NextResponse.json(
        { error: 'notionPageId is required' },
        { status: 400 }
      );
    }

    // Determine new status: use provided status or cycle to next
    let newStatus = status;
    if (!newStatus) {
      // Fetch current status from local cache
      const { data: task } = await supabase
        .from('notion_tasks')
        .select('status')
        .eq('notion_page_id', notionPageId)
        .single();

      const currentIdx = STATUS_CYCLE.indexOf(task?.status ?? 'Not Started');
      newStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      return NextResponse.json(
        { error: 'Notion credentials not configured' },
        { status: 500 }
      );
    }

    // Update in Notion
    const notionRes = await fetch(
      `https://api.notion.com/v1/pages/${notionPageId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          properties: {
            Status: { status: { name: newStatus } },
          },
        }),
      }
    );

    if (!notionRes.ok) {
      const err = await notionRes.text();
      throw new Error(`Notion API error: ${err}`);
    }

    // Update local cache
    const { error: dbError } = await supabase
      .from('notion_tasks')
      .update({ status: newStatus, last_synced: new Date().toISOString() })
      .eq('notion_page_id', notionPageId);

    if (dbError) throw dbError;

    return NextResponse.json({
      notionPageId,
      status: newStatus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update task', details: String(err) },
      { status: 500 }
    );
  }
});

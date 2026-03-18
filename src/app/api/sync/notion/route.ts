import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

function extractTitle(prop: unknown): string {
  const titleProp = prop as { title?: { plain_text: string }[] };
  return titleProp?.title?.[0]?.plain_text || 'Untitled';
}

function extractSelect(prop: unknown): string | null {
  const selectProp = prop as { select?: { name: string } };
  return selectProp?.select?.name || null;
}

function extractStatus(prop: unknown): string {
  const statusProp = prop as { status?: { name: string } };
  return statusProp?.status?.name || 'Not Started';
}

function extractDate(prop: unknown): string | null {
  const dateProp = prop as { date?: { start: string } };
  return dateProp?.date?.start || null;
}

function extractMultiSelect(prop: unknown): string[] {
  const multiProp = prop as { multi_select?: { name: string }[] };
  return multiProp?.multi_select?.map((t) => t.name) || [];
}

// POST: Sync all tasks from Notion to local Supabase cache
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDbId = process.env.NOTION_TASKS_DB_ID;

    if (!notionApiKey || !notionDbId) {
      return NextResponse.json(
        { error: 'Notion credentials not configured' },
        { status: 500 }
      );
    }

    // Fetch all pages with pagination
    const allPages: NotionPage[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const body: Record<string, unknown> = {
        page_size: 100,
      };
      if (startCursor) {
        body.start_cursor = startCursor;
      }

      const res = await fetch(
        `https://api.notion.com/v1/databases/${notionDbId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${notionApiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Notion API error: ${res.status} ${err}`);
      }

      const data: NotionQueryResponse = await res.json();
      allPages.push(...data.results);
      hasMore = data.has_more;
      startCursor = data.next_cursor || undefined;
    }

    // Transform pages to task records (matching n8n transform logic)
    const now = new Date().toISOString();
    const tasks = allPages
      .map((page) => {
        const props = page.properties;
        const status = extractStatus(props['Status']);
        return {
          notion_page_id: page.id,
          name: extractTitle(props['Task name']),
          due_date: extractDate(props['Due']),
          priority: extractSelect(props['Priority']),
          status,
          tags: extractMultiSelect(props['Tags']),
          last_synced: now,
        };
      })
      .filter((t) => t.status !== 'Done' && t.status !== 'Archived');

    // Upsert active tasks to Supabase
    if (tasks.length > 0) {
      const { error: dbError } = await supabase
        .from('notion_tasks')
        .upsert(tasks, { onConflict: 'notion_page_id' });

      if (dbError) throw dbError;
    }

    // Clean up: remove tasks from Supabase that no longer exist in Notion
    // (deleted or moved to Done/Archived in Notion)
    const activePageIds = tasks.map((t) => t.notion_page_id);
    const { data: localTasks } = await supabase
      .from('notion_tasks')
      .select('notion_page_id');

    let deletedCount = 0;
    if (localTasks) {
      const toDelete = localTasks
        .filter((t) => !activePageIds.includes(t.notion_page_id))
        .map((t) => t.notion_page_id);

      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from('notion_tasks')
          .delete()
          .in('notion_page_id', toDelete);

        if (delError) {
          console.error('[Notion Sync] Failed to delete stale tasks:', delError);
        } else {
          deletedCount = toDelete.length;
        }
      }
    }

    return NextResponse.json({
      synced: tasks.length,
      deleted: deletedCount,
      total_in_notion: allPages.length,
      timestamp: now,
    });
  } catch (err) {
    console.error('[API Error] Notion sync failed:', err);
    return NextResponse.json(
      { error: 'Notion sync failed' },
      { status: 500 }
    );
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// POST: Create a new task in Notion and cache locally
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const { name, priority, dueDate } = await req.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDbId = process.env.NOTION_TASKS_DB_ID;

    if (!notionApiKey || !notionDbId) {
      return NextResponse.json(
        { error: 'Notion credentials not configured' },
        { status: 500 }
      );
    }

    // Build Notion page properties
    const properties: Record<string, unknown> = {
      'Task name': { title: [{ text: { content: name } }] },
      Status: { status: { name: 'Not Started' } },
    };

    if (priority && ['Low', 'Medium', 'High'].includes(priority)) {
      properties.Priority = { select: { name: priority } };
    }

    if (dueDate) {
      properties.Due = { date: { start: dueDate } };
    }

    // Create in Notion
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: notionDbId },
        properties,
      }),
    });

    if (!notionRes.ok) {
      const err = await notionRes.text();
      throw new Error(`Notion API error: ${err}`);
    }

    const notionPage = await notionRes.json();

    // Cache locally in Supabase
    const { error: dbError } = await supabase.from('notion_tasks').insert({
      notion_page_id: notionPage.id,
      name,
      priority: priority || null,
      status: 'Not Started',
      due_date: dueDate || null,
    });

    if (dbError) throw dbError;

    return NextResponse.json({
      id: notionPage.id,
      name,
      priority: priority || null,
      status: 'Not Started',
      dueDate: dueDate || null,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create task', details: String(err) },
      { status: 500 }
    );
  }
});

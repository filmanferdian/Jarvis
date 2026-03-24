import { supabase } from '@/lib/supabase';

// Notion context pages — hardcoded page IDs (stable UUIDs)
const CONTEXT_PAGES = [
  { key: 'about_me', pageId: '328c674aecec81b681cfe7432e2e2189' },
  { key: 'communication', pageId: '328c674aecec81c88198eb4eeb74ed93' },
  { key: 'work', pageId: '324c674aecec816db8fbfa9ddfa3742c' },
  { key: 'growth', pageId: '324c674aecec817f8984c4762e691f7c' },
  { key: 'projects', pageId: '324c674aecec81c394c0d593f4afd2a8' },
  { key: 'ghostwriting', pageId: '32dc674aecec817198f2ead59e09873c' },
] as const;

export type ContextPageKey = (typeof CONTEXT_PAGES)[number]['key'];

interface SyncResult {
  synced: string[];
  skipped: string[];
  errors: string[];
}

function getNotionHeaders(): Record<string, string> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error('NOTION_API_KEY not configured');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': '2022-06-28',
  };
}

async function fetchPageMeta(pageId: string): Promise<{ title: string; lastEdited: string }> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: getNotionHeaders(),
  });
  if (!res.ok) throw new Error(`Notion page meta ${pageId}: ${res.status}`);
  const data = await res.json();

  const titleProp = Object.values(data.properties as Record<string, Record<string, unknown>>)
    .find((p) => p.type === 'title');
  const titleArr = (titleProp?.title as Array<{ plain_text: string }>) ?? [];
  const title = titleArr.map((t) => t.plain_text).join('');

  return { title, lastEdited: data.last_edited_time as string };
}

function extractBlockText(block: Record<string, unknown>): string {
  const type = block.type as string;
  const content = block[type] as Record<string, unknown> | undefined;
  if (!content) return '';

  const richText = content.rich_text as Array<{ plain_text: string }> | undefined;
  if (richText) {
    const text = richText.map((t) => t.plain_text).join('');
    if (type === 'heading_1') return `# ${text}`;
    if (type === 'heading_2') return `## ${text}`;
    if (type === 'heading_3') return `### ${text}`;
    if (type === 'bulleted_list_item') return `- ${text}`;
    if (type === 'numbered_list_item') return `- ${text}`;
    if (type === 'to_do') {
      const checked = (content.checked as boolean) ? '[x]' : '[ ]';
      return `- ${checked} ${text}`;
    }
    if (type === 'toggle') return `> ${text}`;
    if (type === 'quote') return `> ${text}`;
    if (type === 'callout') return `> ${text}`;
    if (type === 'divider') return '---';
    return text;
  }

  if (type === 'divider') return '---';
  return '';
}

async function fetchPageContent(pageId: string): Promise<string> {
  const headers = getNotionHeaders();
  const blocks: string[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    url.searchParams.set('page_size', '100');
    if (startCursor) url.searchParams.set('start_cursor', startCursor);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`Notion blocks ${pageId}: ${res.status}`);
    const data = await res.json();

    for (const block of data.results) {
      const text = extractBlockText(block as Record<string, unknown>);
      if (text) blocks.push(text);
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  return blocks.join('\n');
}

export async function syncNotionContext(): Promise<SyncResult> {
  const result: SyncResult = { synced: [], skipped: [], errors: [] };

  // Load existing cache to check last_edited
  const { data: existing } = await supabase
    .from('notion_context')
    .select('page_key, last_edited');
  const cacheMap = new Map(
    (existing ?? []).map((r) => [r.page_key, r.last_edited]),
  );

  for (const page of CONTEXT_PAGES) {
    try {
      const meta = await fetchPageMeta(page.pageId);

      // Skip if unchanged
      if (cacheMap.get(page.key) === meta.lastEdited) {
        result.skipped.push(page.key);
        continue;
      }

      const content = await fetchPageContent(page.pageId);

      await supabase.from('notion_context').upsert({
        page_key: page.key,
        notion_page_id: page.pageId,
        title: meta.title,
        content,
        last_edited: meta.lastEdited,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'page_key' });

      result.synced.push(page.key);
    } catch (err) {
      result.errors.push(`${page.key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

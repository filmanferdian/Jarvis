// One-shot seed for fitness_protocols.cardio (Notion exit, running slice).
//
// Copies the "5. Cardio protocol" section out of the Notion Transformation program page
// and into Supabase, so plan-loader.ts can stop fetching it live. Run this BEFORE the
// plan-loader cutover, while NOTION_API_KEY still resolves the page.
//
// Idempotent: re-running overwrites the row. Refuses to write empty content, because the
// Notion H1 slice returns '' silently when the heading is missing or renamed.
//
// Usage: npx tsx scripts/seed-cardio-protocol.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(p: string) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.resolve(process.cwd(), '.env.local'));          // worktree (may be absent)
loadEnv(path.resolve(process.cwd(), '../../../.env.local')); // repo root

const TRANSFORMATION_PROGRAM_PAGE_ID = '2f2c674aecec819dac40c78f9fb5a517';
const CARDIO_SECTION_HEADING = '5. Cardio protocol';

// Notion block fetching is inlined rather than imported: plan-loader.ts now reads this content
// back out of Supabase and no longer knows how to reach Notion at all.
function blockToText(block: Record<string, unknown>): string {
  const type = block.type as string;
  const content = block[type] as Record<string, unknown> | undefined;
  if (!content) return '';
  const richText = content.rich_text as Array<{ plain_text: string }> | undefined;
  if (!richText) return type === 'divider' ? '---' : '';
  const text = richText.map((t) => t.plain_text).join('');
  if (type === 'heading_1') return `# ${text}`;
  if (type === 'heading_2') return `## ${text}`;
  if (type === 'heading_3') return `### ${text}`;
  if (type === 'bulleted_list_item' || type === 'numbered_list_item') return `- ${text}`;
  if (type === 'to_do') return `- ${(content.checked as boolean) ? '[x]' : '[ ]'} ${text}`;
  if (type === 'toggle' || type === 'quote' || type === 'callout') return `> ${text}`;
  return text;
}

async function fetchCardioSection(apiKey: string): Promise<string> {
  const blocks: string[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${TRANSFORMATION_PROGRAM_PAGE_ID}/children`);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Notion-Version': '2022-06-28' },
    });
    if (!res.ok) throw new Error(`Notion blocks: ${res.status}`);
    const data = await res.json();
    for (const b of data.results) {
      const t = blockToText(b as Record<string, unknown>);
      if (t) blocks.push(t);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const start = blocks.findIndex(
    (b) => b.startsWith('# ') && b.toLowerCase().includes(CARDIO_SECTION_HEADING.toLowerCase()),
  );
  if (start === -1) return '';
  let end = blocks.length;
  for (let i = start + 1; i < blocks.length; i++) {
    if (blocks[i].startsWith('# ')) { end = i; break; }
  }
  return blocks.slice(start, end).join('\n');
}

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error('NOTION_API_KEY not set — this script needs the Notion page to still exist');

  const content = await fetchCardioSection(apiKey);

  if (!content || content.trim().length === 0) {
    throw new Error(
      'Notion returned empty cardio protocol. The "5. Cardio protocol" H1 was probably renamed. ' +
        'Refusing to seed an empty row — fix the heading or paste the content manually.',
    );
  }

  console.log(`Fetched ${content.length} chars from Notion.`);
  console.log('--- first 300 chars ---');
  console.log(content.slice(0, 300));
  console.log('--- end preview ---\n');

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sb.from('fitness_protocols').upsert(
    {
      protocol_key: 'cardio',
      title: 'Cardio protocol',
      content,
      source: `notion:${TRANSFORMATION_PROGRAM_PAGE_ID}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'protocol_key' },
  );
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

  const { data } = await sb
    .from('fitness_protocols')
    .select('protocol_key, title, source, updated_at, content')
    .eq('protocol_key', 'cardio')
    .single();

  console.log('Seeded fitness_protocols:', {
    protocol_key: data?.protocol_key,
    title: data?.title,
    source: data?.source,
    updated_at: data?.updated_at,
    content_length: (data?.content ?? '').length,
  });
}

main()
  .then(() => { setTimeout(() => process.exit(0), 300); })
  .catch((e) => { console.error(e instanceof Error ? e.message : e); setTimeout(() => process.exit(1), 300); });

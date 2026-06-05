// Live reader for valuation memos stored in the "Valuation models (DCF)" Notion database.
// The watchlist universe lives in code (src/data/watchlist.ts); this module only supplies
// the analysis content, joined by ticker.

const VALUATION_DB_ID = 'e058b13554cd4af0822553200d1107cc';
const NOTION_API = 'https://api.notion.com/v1';

export interface MemoProps {
  company: string | null;
  ticker: string;
  market: string | null;
  currency: string | null;
  method: string | null;
  verdict: string | null;
  fairValue: number | null;
  fairValueLow: number | null;
  fairValueHigh: number | null;
  currentPrice: number | null;
  upside: number | null;
  cvShare: number | null;
  wacc: number | null;
  valuationDate: string | null;
}

export interface MemoResult {
  hasMemo: boolean;
  markdown: string | null;
  props: MemoProps | null;
}

function notionHeaders(): Record<string, string> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error('NOTION_API_KEY not configured');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

type RichText = Array<{ plain_text: string }>;
type NotionProps = Record<string, Record<string, unknown>>;

function plainText(prop: Record<string, unknown> | undefined): string | null {
  if (!prop) return null;
  const rich = (prop.rich_text ?? prop.title) as RichText | undefined;
  if (!rich) return null;
  const text = rich.map((t) => t.plain_text).join('').trim();
  return text || null;
}

function selectName(prop: Record<string, unknown> | undefined): string | null {
  const sel = prop?.select as { name?: string } | undefined;
  return sel?.name ?? null;
}

function numberValue(prop: Record<string, unknown> | undefined): number | null {
  const n = prop?.number;
  return typeof n === 'number' ? n : null;
}

function dateStart(prop: Record<string, unknown> | undefined): string | null {
  const d = prop?.date as { start?: string } | undefined;
  return d?.start ?? null;
}

function extractProps(properties: NotionProps): MemoProps {
  return {
    company: plainText(properties['Company']),
    ticker: plainText(properties['Ticker']) ?? '',
    market: selectName(properties['Market']),
    currency: plainText(properties['Currency']),
    method: selectName(properties['Method']),
    verdict: selectName(properties['Verdict']),
    fairValue: numberValue(properties['Fair value per share']),
    fairValueLow: numberValue(properties['Fair value low']),
    fairValueHigh: numberValue(properties['Fair value high']),
    currentPrice: numberValue(properties['Current price']),
    upside: numberValue(properties['Upside %']),
    cvShare: numberValue(properties['CV share of value']),
    wacc: numberValue(properties['WACC']),
    valuationDate: dateStart(properties['Valuation date']),
  };
}

function blockToMarkdown(block: Record<string, unknown>): string {
  const type = block.type as string;
  const content = block[type] as Record<string, unknown> | undefined;
  if (!content) return type === 'divider' ? '---' : '';

  const rich = content.rich_text as RichText | undefined;
  if (!rich) return type === 'divider' ? '---' : '';
  const text = rich.map((t) => t.plain_text).join('');

  switch (type) {
    case 'heading_1':
      return `# ${text}`;
    case 'heading_2':
      return `## ${text}`;
    case 'heading_3':
      return `### ${text}`;
    case 'bulleted_list_item':
      return `- ${text}`;
    case 'numbered_list_item':
      return `- ${text}`;
    case 'quote':
    case 'callout':
    case 'toggle':
      return `> ${text}`;
    default:
      return text;
  }
}

async function fetchPageMarkdown(pageId: string): Promise<string> {
  const headers = notionHeaders();
  const lines: string[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const url = new URL(`${NOTION_API}/blocks/${pageId}/children`);
    url.searchParams.set('page_size', '100');
    if (startCursor) url.searchParams.set('start_cursor', startCursor);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`Notion blocks ${pageId}: ${res.status}`);
    const data = await res.json();

    for (const block of data.results) {
      const md = blockToMarkdown(block as Record<string, unknown>);
      if (md) lines.push(md);
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  return lines.join('\n');
}

// --- Day-keyed caches: live data, but no re-hitting Notion on every navigation. ---
let valuationsCache: { day: string; props: MemoProps[] } | null = null;
const memoCache = new Map<string, { day: string; result: MemoResult }>();

/** Drop the in-memory caches so the next read re-queries Notion. Used by the
 *  page's manual Refresh button after a new valuation is published. */
export function clearValuationCaches(): void {
  valuationsCache = null;
  memoCache.clear();
}

/** Structured props (no memo body) for every valuation in the Notion DB. */
export async function listValuations(): Promise<MemoProps[]> {
  const day = today();
  if (valuationsCache && valuationsCache.day === day) return valuationsCache.props;

  const headers = notionHeaders();
  const props: MemoProps[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const res = await fetch(`${NOTION_API}/databases/${VALUATION_DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(startCursor ? { page_size: 100, start_cursor: startCursor } : { page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion DB query: ${res.status}`);
    const data = await res.json();

    for (const page of data.results) {
      const p = extractProps(page.properties as NotionProps);
      p.ticker = p.ticker.toUpperCase();
      if (p.ticker) props.push(p);
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  valuationsCache = { day, props };
  return props;
}

/** Full memo (markdown + structured props) for one ticker, or { hasMemo: false }. */
export async function getMemoForTicker(ticker: string): Promise<MemoResult> {
  const symbol = ticker.toUpperCase();
  const day = today();
  const cached = memoCache.get(symbol);
  if (cached && cached.day === day) return cached.result;

  const headers = notionHeaders();
  const res = await fetch(`${NOTION_API}/databases/${VALUATION_DB_ID}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filter: { property: 'Ticker', rich_text: { equals: symbol } },
      page_size: 1,
    }),
  });
  if (!res.ok) throw new Error(`Notion DB query: ${res.status}`);
  const data = await res.json();

  const page = data.results?.[0];
  if (!page) {
    const empty: MemoResult = { hasMemo: false, markdown: null, props: null };
    memoCache.set(symbol, { day, result: empty });
    return empty;
  }

  const props = extractProps(page.properties as NotionProps);
  const markdown = await fetchPageMarkdown(page.id as string);
  const result: MemoResult = { hasMemo: true, markdown, props };
  memoCache.set(symbol, { day, result });
  return result;
}

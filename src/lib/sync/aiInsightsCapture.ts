import { supabase } from '@/lib/supabase';
import { sanitizeInline, sanitizeMultiline } from '@/lib/promptEscape';
import { markAccountSynced } from '@/lib/syncTracker';

// Weekly raw capture for the Learnings page (AI topic).
//
// Deliberately contains NO Claude call. This half runs on Railway so the week's
// raw material is banked on schedule regardless of whether the laptop is on;
// Claude Code does the ranking later and writes learning_entries.
//
// Transport is plain fetch. Measured 2026-07-25 via /api/utilities/source-probe:
// Railway has NO curl in its image, and reaches 12 of 13 host families on fetch
// alone (including Reddit at full size). The exception is the Nitter X mirror,
// which fails from Railway at the connection level, so social is opt-in and
// stays off in production. The local scheduled task runs the standalone
// scripts/ai-insights-fetch.mjs, which has curl available, and upserts the X
// items on top of whatever Railway already captured.

const SYNC_TYPE = 'ai-insights-capture';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const AI_RE =
  /\b(ai|llm|gpt|claude|anthropic|openai|gemini|deepseek|qwen|mistral|llama|agent|agentic|rag|mcp|transformer|diffusion|inference|fine-?tun|embedding|neural|model|prompt|token|copilot|cursor|codex|vllm|ollama|hugging ?face|multimodal|reasoning|benchmark|context window)\b/i;

export interface CandidateRow {
  topic: string;
  week_start: string;
  dedupe_key: string;
  source: string;
  lens_hint: string | null;
  title: string;
  url: string | null;
  signal: string | null;
  body: string | null;
  star_count: number | null;
  published: string | null;
}

export interface CaptureResult {
  weekStart: string;
  ranFrom: string;
  inserted: number;
  sourcesOk: string[];
  sourcesFailed: string[];
  errors: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, json = false, timeoutMs = 20000, retries = 0): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: json ? 'application/json' : 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      const body = await res.text();
      // A 200 with an empty body is the signature of a refused TLS fingerprint,
      // not a success. Treat it as failure so it lands in sourcesFailed.
      if (res.status === 200 && body.length > 0) return body;
      if (attempt >= retries) {
        throw new Error(res.status === 200 ? 'HTTP 200 but empty body' : `HTTP ${res.status}`);
      }
    } catch (err) {
      if (attempt >= retries) throw err;
    }
    await sleep((attempt + 1) * 10000);
  }
}

// --- hand-rolled XML parsing, matching src/lib/sources/googleNewsRss.ts ---

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/').replace(/&amp;/g, '&');
}

// CDATA must be unwrapped BEFORE tags are stripped: `<![CDATA[Title]]>` matches
// /<[^>]*>/ and would otherwise delete the whole payload, silently zeroing every
// Substack and OpenAI feed.
const uncdata = (s: string) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const stripTags = (s: string) => decodeEntities(uncdata(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function one(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

interface FeedItem {
  title: string;
  url: string;
  published: Date | null;
  body: string;
}

function parseFeed(xml: string): FeedItem[] {
  const blocks = [
    ...[...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]),
    ...[...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map((m) => m[0]),
  ];
  return blocks.map((b) => {
    let link = stripTags(one(b, 'link'));
    if (!link) {
      const href = b.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (href) link = href[1];
    }
    const raw =
      stripTags(one(b, 'pubDate')) || stripTags(one(b, 'published')) ||
      stripTags(one(b, 'updated')) || stripTags(one(b, 'dc:date'));
    const d = raw ? new Date(raw) : null;
    return {
      title: stripTags(one(b, 'title')),
      url: link,
      published: d && !Number.isNaN(d.getTime()) ? d : null,
      body: stripTags(one(b, 'description') || one(b, 'content') || one(b, 'summary')).slice(0, 400),
    };
  });
}

const normalizeKey = (u: string) =>
  (u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();

// --- source definitions ---

const VENDORS: [string, string][] = [
  ['OpenAI', 'https://openai.com/news/rss.xml'],
  ['Google AI', 'https://blog.google/technology/ai/rss/'],
  ['DeepMind', 'https://deepmind.google/blog/rss.xml'],
  ['Hugging Face', 'https://huggingface.co/blog/feed.xml'],
];

const NEWSLETTERS: [string, string][] = [
  ['Import AI', 'https://jack-clark.net/feed/'],
  ['Latent Space', 'https://www.latent.space/feed'],
  ['Interconnects', 'https://www.interconnects.ai/feed'],
  ['Simon Willison', 'https://simonwillison.net/atom/everything/'],
  ['Lilian Weng', 'https://lilianweng.github.io/index.xml'],
];

const SUBS = ['LocalLLaMA', 'MachineLearning', 'ClaudeAI'];
const NITTER = ['AnthropicAI', 'OpenAI', 'simonw', 'swyx'];

// The partition key every row in this feature is filed under. Must be anchored
// to a weekday, not to "today minus 7 days": the capture and the Claude Code
// ranking task run on different ticks, and an unanchored key silently gives them
// different weeks whenever they land on different days. That is exactly what
// happened on 2026-07-26, when a Saturday capture keyed 2026-07-18 and the
// Sunday ranking looked for 2026-07-25.
//
// Anchor is the most recent Saturday on or before the WIB date, so a Saturday
// and the Sunday after it resolve to the same week.
export function wibWeekStart(now = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const daysSinceSaturday = (wib.getUTCDay() + 1) % 7; // Sat=0, Sun=1, ... Fri=6
  const saturday = new Date(wib.getTime() - daysSinceSaturday * 864e5);
  return saturday.toISOString().slice(0, 10);
}

/**
 * Has this week's capture already been banked?
 *
 * The scheduler can double-fire: on 2026-07-25 the capture ran twice, three
 * minutes apart. Gating on the week actually captured makes a re-fire a no-op
 * without needing a time window. On a query error it returns false so the
 * capture still runs: a duplicate upsert is harmless, a skipped week is not.
 */
export async function alreadyCapturedThisWeek(weekStart: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('learning_capture_runs')
    .select('id')
    .eq('topic', 'ai')
    .eq('week_start', weekStart)
    .limit(1);
  if (error) {
    console.error('[ai-insights-capture] capture-run lookup failed:', error.message);
    return false;
  }
  return (data || []).length > 0;
}

export async function captureAiInsights(
  opts: { includeSocial?: boolean; ranFrom?: string } = {},
): Promise<CaptureResult> {
  const { includeSocial = false, ranFrom = 'railway' } = opts;
  const weekStart = wibWeekStart();
  const since = new Date(Date.now() - 7 * 864e5);
  const sinceIso = since.toISOString().slice(0, 10);

  const items: CandidateRow[] = [];
  const sourcesOk: string[] = [];
  const sourcesFailed: string[] = [];
  const errors: string[] = [];

  const push = (r: Omit<CandidateRow, 'topic' | 'week_start'>) => {
    if (!r.title || !r.dedupe_key) return;
    items.push({ topic: 'ai', week_start: weekStart, ...r });
  };

  const ok = (name: string, n: number) => {
    sourcesOk.push(name);
    void markAccountSynced(SYNC_TYPE, `source:${name}`, 'success', n);
  };
  const fail = (name: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    sourcesFailed.push(name);
    errors.push(`${name}: ${msg}`.slice(0, 200));
    void markAccountSynced(SYNC_TYPE, `source:${name}`, 'error', 0, msg.slice(0, 500));
  };

  // GitHub. Two windows: newly-created hot repos, and large actively-pushed ones.
  // star_count is persisted so next week can rank on velocity instead of totals.
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const ghQueries: [string, string][] = [
    ['new-hot', `created:>${since90} stars:>400 topic:llm`],
    ['new-agents', `created:>${since90} stars:>250 topic:ai-agent`],
    ['mcp', `created:>${since90} stars:>150 topic:mcp`],
    ['active-llm', `pushed:>${sinceIso} stars:>8000 topic:llm`],
  ];
  for (const [label, q] of ghQueries) {
    try {
      const raw = await get(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`, true);
      const data = JSON.parse(raw) as {
        items?: { full_name: string; description: string | null; html_url: string; stargazers_count: number; created_at: string; language: string | null }[];
      };
      for (const r of data.items || []) {
        push({
          dedupe_key: normalizeKey(r.html_url),
          source: 'GitHub',
          lens_hint: 'github',
          title: sanitizeInline(r.full_name, 200),
          url: r.html_url,
          signal: `${(r.stargazers_count / 1000).toFixed(1)}k stars`,
          body: sanitizeMultiline(`${r.description || ''} [lang:${r.language || 'n/a'}, created:${(r.created_at || '').slice(0, 10)}]`, 600),
          star_count: r.stargazers_count,
          published: (r.created_at || '').slice(0, 10) || null,
        });
      }
      ok(`GitHub:${label}`, (data.items || []).length);
    } catch (err) {
      fail(`GitHub:${label}`, err);
    }
  }

  // Hacker News
  try {
    const ts = Math.floor(since.getTime() / 1000);
    const nf = encodeURIComponent(`created_at_i>${ts},points>80`);
    const raw = await get(`https://hn.algolia.com/api/v1/search?tags=story&numericFilters=${nf}&hitsPerPage=100`, true);
    const data = JSON.parse(raw) as {
      hits?: { title: string; url: string | null; objectID: string; points: number; num_comments: number; created_at: string }[];
    };
    const hits = (data.hits || []).filter((h) => AI_RE.test(h.title || '')).slice(0, 25);
    for (const h of hits) {
      const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      push({
        dedupe_key: normalizeKey(url),
        source: 'Hacker News',
        lens_hint: null,
        title: sanitizeInline(h.title, 300),
        url,
        signal: `HN ${h.points} pts, ${h.num_comments || 0} comments`,
        body: null,
        star_count: null,
        published: (h.created_at || '').slice(0, 10) || null,
      });
    }
    ok('Hacker News', hits.length);
  } catch (err) {
    fail('Hacker News', err);
  }

  // RSS families. Reddit is serialized with backoff because it rate-limits on a
  // rolling IP window and returns 429 to every transport equally.
  const rssGroups: { name: string; url: string; lens: string | null; aiFilter: boolean; retries: number; gapMs: number }[] = [
    ...SUBS.map((s) => ({ name: `r/${s}`, url: `https://www.reddit.com/r/${s}/top/.rss?t=week`, lens: null, aiFilter: false, retries: 3, gapMs: 10000 })),
    ...VENDORS.map(([n, u]) => ({ name: n, url: u, lens: 'industry', aiFilter: false, retries: 0, gapMs: 0 })),
    ...NEWSLETTERS.map(([n, u]) => ({ name: n, url: u, lens: null, aiFilter: false, retries: 0, gapMs: 0 })),
    ...(includeSocial
      ? NITTER.map((a) => ({ name: `@${a}`, url: `https://nitter.net/${a}/rss`, lens: null, aiFilter: true, retries: 0, gapMs: 1500 }))
      : []),
  ];

  for (const g of rssGroups) {
    try {
      const parsed = parseFeed(await get(g.url, false, 20000, g.retries))
        .filter((i) => i.title && i.url)
        .filter((i) => !i.published || i.published >= since)
        .filter((i) => !g.aiFilter || AI_RE.test(`${i.title} ${i.body}`))
        .slice(0, 15);
      for (const i of parsed) {
        push({
          dedupe_key: normalizeKey(i.url),
          source: g.name,
          lens_hint: g.lens,
          title: sanitizeInline(i.title, 300),
          url: i.url,
          signal: null,
          body: sanitizeMultiline(i.body, 600),
          star_count: null,
          published: i.published ? i.published.toISOString().slice(0, 10) : null,
        });
      }
      ok(g.name, parsed.length);
    } catch (err) {
      fail(g.name, err);
    }
    if (g.gapMs) await sleep(g.gapMs);
  }

  // Dedupe within this run, then upsert. The unique key makes a re-run in the
  // same week refresh rows instead of duplicating them, so the local task can
  // safely re-capture on top of whatever Railway already banked.
  const seen = new Set<string>();
  const unique = items.filter((i) => (seen.has(i.dedupe_key) ? false : (seen.add(i.dedupe_key), true)));

  if (unique.length > 0) {
    const { error } = await supabase
      .from('learning_candidates')
      .upsert(unique, { onConflict: 'topic,week_start,dedupe_key' });
    if (error) throw error;
  }

  await supabase.from('learning_capture_runs').insert({
    topic: 'ai',
    week_start: weekStart,
    ran_from: ranFrom,
    sources_ok: sourcesOk,
    sources_failed: sourcesFailed,
    item_count: unique.length,
    errors: errors.slice(0, 20),
  });

  return { weekStart, ranFrom, inserted: unique.length, sourcesOk, sourcesFailed, errors };
}

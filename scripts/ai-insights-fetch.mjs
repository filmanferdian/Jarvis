#!/usr/bin/env node
//
// AI insights weekly fetcher. Feeds the /learnings page (AI tab).
//
//   node scripts/ai-insights-fetch.mjs > out.json     # default 7-day window
//   DAYS=14 node scripts/ai-insights-fetch.mjs        # wider window
//
// Pure fetch + parse: no AI, no npm deps, so running this costs no Anthropic
// API credits. The weekly Claude Code scheduled task runs it, then does the
// ranking and writes rows into learning_entries / learning_runs. Jarvis only
// reads those tables.
//
// Output: { since, generated, health[], count, items[] } on stdout. Per-source
// failures are isolated into health[] and never abort the run.
//
// Two non-obvious things this file exists to encode:
//   1. Transport is fetch-first with a curl fallback. See get() below.
//   2. CDATA is unwrapped before tags are stripped. See stripTags() below.
// Both failure modes are silent (zero items, HTTP 200), not loud, so verify
// with the health[] output rather than assuming a green exit code means data.
//
// Measured 2026-07-25 via /api/utilities/source-probe, run on both machines:
//   - Node fetch handles 12 of the 13 host families on macOS AND on Railway.
//   - nitter.net is the sole exception: it hands undici a 200 with an EMPTY
//     body while serving curl normally.
//   - curl is NOT installed in Railway's Railpack image, and nitter.net is
//     unreachable from Railway's egress anyway (connection-level failure).
// So X coverage is Mac-only by construction, and everything else runs in both
// places. Do not "simplify" this back to curl-only; that breaks Railway
// entirely. Re-run the probe from Utilities before changing any of it.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Concurrency-limited map.
async function pmap(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch { out[idx] = null; }
    }
  }));
  return out;
}
const DAYS = Number(process.env.DAYS || 7);
const SINCE = new Date(Date.now() - DAYS * 864e5);
const SINCE_ISO = SINCE.toISOString().slice(0, 10);

const AI_RE = /\b(ai|llm|gpt|claude|anthropic|openai|gemini|deepseek|qwen|mistral|llama|agent|agentic|rag|mcp|transformer|diffusion|inference|fine-?tun|embedding|neural|model|prompt|token|copilot|cursor|codex|vllm|ollama|hugging ?face|multimodal|reasoning|benchmark|context window)\b/i;

const results = [];
const health = [];

// Is curl available? Probed once. Absent on Railway, present on macOS.
const HAS_CURL = await execFileP('curl', ['--version'], { timeout: 5000 }).then(
  () => true,
  () => false,
);

function accept(json) {
  return json ? 'application/json' : 'application/rss+xml, application/xml, text/xml, */*';
}

async function rawFetch(url, json, timeout) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept(json) },
    signal: AbortSignal.timeout(timeout * 1000),
    redirect: 'follow',
  });
  return { code: res.status, body: await res.text() };
}

async function rawCurl(url, json, timeout) {
  const { stdout } = await execFileP(
    'curl',
    ['-sL', '--compressed', '-m', String(timeout), '-A', UA, '-H', `Accept: ${accept(json)}`, '-w', '\n%{http_code}', url],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  const cut = stdout.lastIndexOf('\n');
  return { code: Number(stdout.slice(cut + 1).trim()), body: stdout.slice(0, cut) };
}

// Fetch-first, curl only as a fallback. A 200 with an empty body is the
// signature of undici being refused (nitter.net), so it is treated as a
// failure worth retrying on the other transport rather than as success.
async function get(url, { json = false, timeout = 25, retries = 1 } = {}) {
  let last = 'no attempt';

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const transport of HAS_CURL ? ['fetch', 'curl'] : ['fetch']) {
      try {
        const { code, body } = await (transport === 'fetch'
          ? rawFetch(url, json, timeout)
          : rawCurl(url, json, timeout));

        if (code === 200 && body.length > 0) return json ? JSON.parse(body) : body;
        last = code === 200 ? `HTTP 200 but empty body (${transport} blocked)` : `HTTP ${code} (${transport})`;
      } catch (err) {
        last = `${transport} failed: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`;
      }
    }
    // Reddit throttles on a rolling IP window and returns 429 to both
    // transports, so backoff is the only thing that helps there.
    if (attempt < retries) await sleep((attempt + 1) * 10000);
  }
  throw new Error(last);
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/').replace(/&mdash;/g, ', ')
    .replace(/&amp;/g, '&');
}
// CDATA must be unwrapped BEFORE stripping tags: `<![CDATA[Title]]>` matches
// /<[^>]*>/ and would otherwise delete the entire payload, silently zeroing
// every Substack/OpenAI feed.
const uncdata = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const stripTags = (s) => decodeEntities(uncdata(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const one = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
};

// Handles both RSS <item> and Atom <entry>.
function parseFeed(xml) {
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
    const dateRaw = stripTags(one(b, 'pubDate')) || stripTags(one(b, 'published')) || stripTags(one(b, 'updated')) || stripTags(one(b, 'dc:date'));
    return {
      title: stripTags(one(b, 'title')),
      url: link,
      published: dateRaw ? new Date(dateRaw) : null,
      body: stripTags(one(b, 'description') || one(b, 'content') || one(b, 'summary')).slice(0, 400),
    };
  });
}

async function feed({ name, url, lens, aiFilter = false, limit = 12, retries = 1 }) {
  try {
    const items = parseFeed(await get(url, { retries }))
      .filter((i) => i.title && i.url)
      .filter((i) => !i.published || i.published >= SINCE)
      .filter((i) => !aiFilter || AI_RE.test(i.title + ' ' + i.body))
      .slice(0, limit);
    items.forEach((i) => results.push({
      source: name, lens, title: i.title, url: i.url,
      signal: '', published: i.published ? i.published.toISOString().slice(0, 10) : '',
      body: i.body,
    }));
    health.push({ source: name, ok: true, n: items.length });
  } catch (e) {
    health.push({ source: name, ok: false, n: 0, error: String(e.message || e) });
  }
}

async function github(label, q, lens, limit = 10) {
  try {
    const d = await get(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${limit}`, { json: true });
    (d.items || []).forEach((r) => results.push({
      source: 'GitHub', lens,
      title: `${r.full_name} — ${r.description || ''}`.slice(0, 240),
      url: r.html_url,
      signal: `${(r.stargazers_count / 1000).toFixed(1)}k stars${r.created_at > SINCE_ISO ? ', new this week' : ''}`,
      published: (r.created_at || '').slice(0, 10),
      body: `${r.description || ''} [lang:${r.language || 'n/a'}, created:${(r.created_at || '').slice(0, 10)}, forks:${r.forks_count}]`,
    }));
    health.push({ source: `GitHub:${label}`, ok: true, n: (d.items || []).length });
  } catch (e) {
    health.push({ source: `GitHub:${label}`, ok: false, n: 0, error: String(e.message || e) });
  }
}

async function hn() {
  try {
    const ts = Math.floor(SINCE.getTime() / 1000);
    // '>' must be percent-encoded or Algolia 400s.
    const nf = encodeURIComponent(`created_at_i>${ts},points>80`);
    const d = await get(`https://hn.algolia.com/api/v1/search?tags=story&numericFilters=${nf}&hitsPerPage=100`, { json: true });
    const hits = (d.hits || []).filter((h) => AI_RE.test(h.title || '')).slice(0, 25);
    hits.forEach((h) => results.push({
      source: 'Hacker News', lens: 'auto', title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      signal: `HN ${h.points} pts, ${h.num_comments || 0} comments`,
      published: (h.created_at || '').slice(0, 10), body: '',
    }));
    health.push({ source: 'Hacker News', ok: true, n: hits.length });
  } catch (e) {
    health.push({ source: 'Hacker News', ok: false, n: 0, error: String(e.message || e) });
  }
}

const SUBS = ['LocalLLaMA', 'MachineLearning', 'ClaudeAI'];
const NITTER = ['AnthropicAI', 'OpenAI', 'simonw', 'swyx'];

const NEWSLETTERS = [
  ['Import AI (Jack Clark)', 'https://jack-clark.net/feed/'],
  ['Latent Space', 'https://www.latent.space/feed'],
  ['Interconnects', 'https://www.interconnects.ai/feed'],
  ['Simon Willison', 'https://simonwillison.net/atom/everything/'],
  ['Lilian Weng', 'https://lilianweng.github.io/index.xml'],
];
const VENDORS = [
  ['OpenAI', 'https://openai.com/news/rss.xml'],
  ['Google AI', 'https://blog.google/technology/ai/rss/'],
  ['DeepMind', 'https://deepmind.google/blog/rss.xml'],
  ['Hugging Face', 'https://huggingface.co/blog/feed.xml'],
];

const since90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

// Reddit and Nitter rate-limit per host, so they get serialized lanes with a gap.
// Everything else fans out.
const redditLane = (async () => {
  for (const s of SUBS) {
    await feed({ name: `r/${s}`, url: `https://www.reddit.com/r/${s}/top/.rss?t=week`, lens: 'auto', limit: 15, retries: 3 });
    await sleep(10000);
  }
})();

const nitterLane = (async () => {
  for (const a of NITTER) {
    await feed({ name: `@${a}`, url: `https://nitter.net/${a}/rss`, lens: 'auto', aiFilter: true, limit: 10 });
    await sleep(1500);
  }
})();

const restLane = pmap(
  [
    () => github('new-hot', `created:>${since90} stars:>400 topic:llm`, 'github'),
    () => github('new-agents', `created:>${since90} stars:>250 topic:ai-agent`, 'github'),
    () => github('mcp', `created:>${since90} stars:>150 topic:mcp`, 'github'),
    () => github('active-llm', `pushed:>${SINCE_ISO} stars:>8000 topic:llm`, 'github'),
    () => hn(),
    ...NEWSLETTERS.map(([n, u]) => () => feed({ name: n, url: u, lens: 'auto', limit: 10 })),
    ...VENDORS.map(([n, u]) => () => feed({ name: n, url: u, lens: 'industry', limit: 8 })),
  ],
  4,
  (fn) => fn(),
);

await Promise.allSettled([redditLane, nitterLane, restLane]);

// Dedupe by normalized URL.
const seen = new Set();
const deduped = results.filter((r) => {
  const k = (r.url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  if (!k || seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(JSON.stringify({ since: SINCE_ISO, generated: new Date().toISOString(), health, count: deduped.length, items: deduped }, null, 1));

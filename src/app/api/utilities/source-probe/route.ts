import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withAuth } from '@/lib/auth';
import { safeError } from '@/lib/errors';

// Reachability probe for the external feeds behind the Learnings page.
//
// Exists because "can Jarvis fetch this?" has two independent answers and both
// have bitten this project before:
//   1. TLS fingerprint. Cloudflare-fronted hosts hand Node's fetch a 200 with an
//      EMPTY body while serving curl normally, so a fetch-only check reports
//      success on zero data.
//   2. Egress IP. Railway runs on a datacenter range that Cloudflare already
//      blocks for this project (sso.garmin.com, and the Revolut careers source
//      that has never worked from production). curl cannot fix an IP block.
//
// So each target is tried BOTH ways and the row shows where it actually breaks.
// Run it from the Utilities page against production to see Railway's answer;
// run it against localhost to see your Mac's.

export const maxDuration = 120;

const execFileP = promisify(execFile);
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT_S = 15;

interface Target {
  name: string;
  group: 'api' | 'social' | 'vendor' | 'newsletter';
  url: string;
}

// One representative URL per host family. Probing every GitHub query or every
// subreddit would only re-test the same host.
const TARGETS: Target[] = [
  { name: 'GitHub API', group: 'api', url: 'https://api.github.com/search/repositories?q=topic:llm&per_page=1' },
  { name: 'Hacker News', group: 'api', url: 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=1' },
  { name: 'Reddit', group: 'social', url: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=week' },
  { name: 'X (Nitter)', group: 'social', url: 'https://nitter.net/AnthropicAI/rss' },
  { name: 'OpenAI', group: 'vendor', url: 'https://openai.com/news/rss.xml' },
  { name: 'Google AI', group: 'vendor', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'DeepMind', group: 'vendor', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Hugging Face', group: 'vendor', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Import AI', group: 'newsletter', url: 'https://jack-clark.net/feed/' },
  { name: 'Latent Space', group: 'newsletter', url: 'https://www.latent.space/feed' },
  { name: 'Interconnects', group: 'newsletter', url: 'https://www.interconnects.ai/feed' },
  { name: 'Simon Willison', group: 'newsletter', url: 'https://simonwillison.net/atom/everything/' },
  { name: 'Lilian Weng', group: 'newsletter', url: 'https://lilianweng.github.io/index.xml' },
];

interface Attempt {
  ok: boolean;
  status: number;
  bytes: number;
  note?: string;
}

// A 200 with an empty body is the signature failure here, so it is reported as
// a distinct outcome rather than folded into "ok".
function classify(status: number, bytes: number): Attempt {
  if (status === 200 && bytes === 0) return { ok: false, status, bytes, note: 'empty body (blocked)' };
  if (status === 200) return { ok: true, status, bytes };
  if (status === 403) return { ok: false, status, bytes, note: 'forbidden (bot or IP block)' };
  if (status === 429) return { ok: false, status, bytes, note: 'rate limited' };
  return { ok: false, status, bytes };
}

async function viaCurl(url: string): Promise<Attempt> {
  try {
    const { stdout } = await execFileP(
      'curl',
      ['-sL', '--compressed', '-m', String(TIMEOUT_S), '-A', UA, '-w', '\n%{http_code}', url],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const cut = stdout.lastIndexOf('\n');
    return classify(Number(stdout.slice(cut + 1).trim()), stdout.slice(0, cut).length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, bytes: 0, note: /ENOENT/.test(msg) ? 'curl not installed' : 'request failed' };
  }
}

async function viaFetch(url: string): Promise<Attempt> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_S * 1000) });
    const body = await res.text();
    return classify(res.status, body.length);
  } catch {
    return { ok: false, status: 0, bytes: 0, note: 'request failed' };
  }
}

// Bounded concurrency: 13 targets times 2 methods would otherwise open 26
// sockets at once and make the rate-limited hosts look worse than they are.
async function pmap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export const GET = withAuth(async (_req: NextRequest) => {
  try {
    let curlVersion: string | null = null;
    try {
      const { stdout } = await execFileP('curl', ['--version'], { timeout: 5000 });
      curlVersion = stdout.split('\n')[0]?.trim() || null;
    } catch {
      curlVersion = null;
    }

    let egressIp: string | null = null;
    try {
      const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(8000) });
      egressIp = ((await r.json()) as { ip?: string }).ip ?? null;
    } catch {
      egressIp = null;
    }

    const results = await pmap(TARGETS, 4, async (t) => {
      const [curl, fetchRes] = await Promise.all([
        curlVersion ? viaCurl(t.url) : Promise.resolve<Attempt>({ ok: false, status: 0, bytes: 0, note: 'curl not installed' }),
        viaFetch(t.url),
      ]);
      return {
        name: t.name,
        group: t.group,
        host: new URL(t.url).host,
        curl,
        fetch: fetchRes,
        reachable: curl.ok || fetchRes.ok,
      };
    });

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      runtime: { node: process.version, curlVersion, egressIp },
      summary: {
        total: results.length,
        reachable: results.filter((r) => r.reachable).length,
        curlOnly: results.filter((r) => r.curl.ok && !r.fetch.ok).length,
        unreachable: results.filter((r) => !r.reachable).length,
      },
      results,
    });
  } catch (err) {
    return safeError('Source probe failed', err);
  }
});

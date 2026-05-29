import type { JobSource, RawJob, SourceResult } from './types';

const COMPANY = 'Revolut';
// No public API. revolut.com/careers sits behind a Cloudflare JS challenge that
// blocks server-side fetches (verified: 403 "Just a quick security check").
// We attempt a best-effort fetch with browser headers; if the challenge or a
// non-OK status is detected we return a clean source failure rather than
// scraping a challenge page. Solving the challenge would need a headless
// browser, out of scope for a Railway cron. FRAGILE by design.
const LISTING_URL = 'https://www.revolut.com/careers/';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const CHALLENGE_MARKERS = /just a (quick |moment)|cf_chl|cf-challenge|enable javascript|attention required/i;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const revolutSource: JobSource = {
  company: COMPANY,
  async fetch(): Promise<SourceResult> {
    try {
      const res = await fetch(LISTING_URL, { headers: BROWSER_HEADERS });
      const html = await res.text();

      if (!res.ok || CHALLENGE_MARKERS.test(html)) {
        throw new Error(`Blocked by Cloudflare bot protection (HTTP ${res.status})`);
      }

      // If Revolut ever serves listings to server-side clients, they render as
      // anchors to /careers/position/<slug>. Parse best-effort.
      const seen = new Set<string>();
      const jobs: RawJob[] = [];
      for (const m of html.matchAll(/<a[^>]+href="\/careers\/position\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const slug = m[1];
        if (seen.has(slug)) continue;
        seen.add(slug);
        const title = stripTags(m[2]);
        if (!title) continue;
        jobs.push({
          company: COMPANY,
          external_id: slug,
          title,
          department: null,
          location: null,
          url: `https://www.revolut.com/careers/position/${slug}`,
          description_raw: null,
        });
      }

      if (jobs.length === 0) throw new Error('No positions parsed (challenge or markup change)');
      return { company: COMPANY, ok: true, jobs };
    } catch (err) {
      return {
        company: COMPANY,
        ok: false,
        jobs: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

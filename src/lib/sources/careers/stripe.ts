import type { JobSource, RawJob, SourceResult } from './types';

const COMPANY = 'Stripe';
// No public JSON API. The search page is server-rendered HTML; filtering is
// client-side, so we fetch the full board and gate by location downstream.
// FRAGILE: breaks if Stripe changes the `JobsListings__*` markup. A markup
// change yields zero rows, surfaced as a source failure on the page.
const SEARCH_URL = 'https://stripe.com/jobs/search';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const stripeSource: JobSource = {
  company: COMPANY,
  async fetch(): Promise<SourceResult> {
    try {
      const res = await fetch(SEARCH_URL, { headers: BROWSER_HEADERS });
      if (!res.ok) throw new Error(`Stripe HTTP ${res.status}`);
      const html = await res.text();

      const rows = html.split('<tr class="TableRow">').slice(1);
      const seen = new Set<string>();
      const jobs: RawJob[] = [];

      for (const row of rows) {
        const href = row.match(/\/jobs\/listing\/([^/"]+)\/(\d+)/);
        if (!href) continue;
        const id = href[2];
        if (seen.has(id)) continue;
        seen.add(id);

        const titleM = row.match(/JobsListings__link[\s\S]*?>([^<]+)<\/a>/);
        const title = titleM ? titleM[1].trim() : '';
        if (!title) continue;

        const departments = [...row.matchAll(/JobsListings__departmentsListItem[^>]*>([\s\S]*?)<\/li>/g)]
          .map((m) => stripTags(m[1]))
          .filter(Boolean);
        const locations = [...row.matchAll(/JobsListings__locationDisplayName">([^<]+)<\/span>/g)]
          .map((m) => m[1].trim())
          .filter(Boolean);

        jobs.push({
          company: COMPANY,
          external_id: id,
          title,
          department: departments.join(', ') || null,
          location: locations.join(' | ') || null,
          url: `https://stripe.com/jobs/listing/${href[1]}/${id}`,
          description_raw: null, // listing page carries no JD text
        });
      }

      if (jobs.length === 0) throw new Error('Parsed 0 rows (markup may have changed)');
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

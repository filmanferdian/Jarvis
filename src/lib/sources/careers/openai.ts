import type { JobSource, RawJob, SourceResult } from './types';

const COMPANY = 'OpenAI';
// OpenAI publishes its board through Ashby's clean public posting API. No
// scraping, stable JSON. Returns ~700 roles across all teams/regions.
const BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/openai';

interface AshbyJob {
  id: string;
  title?: string;
  department?: string | null;
  team?: string | null;
  location?: string | null;
  secondaryLocations?: { location?: string }[];
  isListed?: boolean;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
}

export const openaiSource: JobSource = {
  company: COMPANY,
  async fetch(): Promise<SourceResult> {
    try {
      const res = await fetch(BOARD_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Ashby HTTP ${res.status}`);

      const data = (await res.json()) as { jobs?: AshbyJob[] };
      const jobs: RawJob[] = (data.jobs || [])
        .filter((j) => j.isListed !== false && j.id && j.jobUrl)
        .map((j) => {
          // Fold primary + secondary locations into one string so the location
          // gate catches an in-region option even when it is listed secondarily
          // (e.g. primary "Sydney" with a "Singapore" secondary still passes).
          const locParts = [j.location, ...(j.secondaryLocations || []).map((s) => s?.location)]
            .map((l) => (l || '').trim())
            .filter(Boolean);
          const location = locParts.length ? [...new Set(locParts)].join('; ') : null;
          return {
            company: COMPANY,
            external_id: j.id,
            title: j.title?.trim() || 'Untitled',
            department: j.department?.trim() || j.team?.trim() || null,
            location,
            url: j.jobUrl!,
            description_raw: j.descriptionPlain?.trim().slice(0, 8000) || null,
          };
        });

      // Zero listed jobs from a normally-busy board signals an API shape change.
      if (jobs.length === 0) throw new Error('Ashby returned zero listed jobs');

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

import type { JobSource, RawJob, SourceResult } from './types';
import { htmlToText } from './html';

const COMPANY = 'Anthropic';
const BOARD_URL = 'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs?content=true';

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  departments?: { name?: string }[];
  content?: string;
}

// Anthropic publishes a clean public Greenhouse board API. No scraping, stable.
export const anthropicSource: JobSource = {
  company: COMPANY,
  async fetch(): Promise<SourceResult> {
    try {
      const res = await fetch(BOARD_URL, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Greenhouse HTTP ${res.status}`);

      const data = (await res.json()) as { jobs?: GreenhouseJob[] };
      const jobs: RawJob[] = (data.jobs || []).map((j) => ({
        company: COMPANY,
        external_id: String(j.id),
        title: j.title?.trim() || 'Untitled',
        department: j.departments?.map((d) => d.name).filter(Boolean).join(', ') || null,
        location: j.location?.name?.trim() || null,
        url: j.absolute_url,
        description_raw: htmlToText(j.content),
      }));

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

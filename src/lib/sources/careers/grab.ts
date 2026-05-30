import type { JobSource, RawJob, SourceResult } from './types';

const COMPANY = 'Grab';
// Grab publishes its board through SmartRecruiters' public posting API. Clean
// JSON, paginated (max 100 per page). The list endpoint carries no job
// description, so description_raw is left null (same as the Stripe source);
// scoring falls back to title + department, which the rubric handles.
const API = 'https://api.smartrecruiters.com/v1/companies/Grab/postings';
const PAGE = 100;

interface SrLabel {
  label?: string;
}
interface SrPosting {
  id: string;
  name?: string;
  department?: SrLabel;
  function?: SrLabel;
  location?: { city?: string; country?: string; fullLocation?: string };
}

export const grabSource: JobSource = {
  company: COMPANY,
  async fetch(): Promise<SourceResult> {
    try {
      const all: SrPosting[] = [];
      let offset = 0;
      // Page until we have everything; cap iterations defensively.
      for (let i = 0; i < 20; i++) {
        const res = await fetch(`${API}?limit=${PAGE}&offset=${offset}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`SmartRecruiters HTTP ${res.status}`);
        const data = (await res.json()) as { totalFound?: number; content?: SrPosting[] };
        const batch = data.content || [];
        all.push(...batch);
        offset += PAGE;
        if (batch.length < PAGE || offset >= (data.totalFound ?? 0)) break;
      }

      const jobs: RawJob[] = all
        .filter((p) => p.id && p.name)
        .map((p) => {
          const loc = p.location || {};
          const location =
            loc.fullLocation?.trim() ||
            [loc.city, loc.country].map((s) => (s || '').trim()).filter(Boolean).join(', ') ||
            null;
          return {
            company: COMPANY,
            external_id: p.id,
            title: p.name!.trim(),
            department: p.department?.label?.trim() || p.function?.label?.trim() || null,
            location,
            url: `https://jobs.smartrecruiters.com/Grab/${p.id}`,
            description_raw: null,
          };
        });

      if (jobs.length === 0) throw new Error('SmartRecruiters returned zero postings');
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

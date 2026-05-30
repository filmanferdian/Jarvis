import type { JobSource, RawJob, SourceResult } from './types';
import { htmlToText } from './html';

const COMPANY = 'GoTo';
// GoTo Group's careers site (gotocompany.com) is a client-rendered app backed
// by a clean public JSON API. This exposes the HoldCo (group corporate) roles
// only; the Gojek / GoPay / Tokopedia entities run on separate career sites.
// Jobs come grouped by department under data.items[].job_list[].
const API = 'https://content.goinfra.co.id/ent-hris/career/job?company=HoldCo';

interface GotoJob {
  id: string;
  text?: string;
  state?: string;
  distributionChannels?: string[];
  categories?: { department?: string; location?: string; team?: string };
  content?: { descriptionHtml?: string; lists?: { text?: string; content?: string }[] };
}
interface GotoGroup {
  parent_department?: string;
  job_list?: GotoJob[];
}

export const gotoSource: JobSource = {
  company: COMPANY,
  async fetch(): Promise<SourceResult> {
    try {
      const res = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`GoTo API HTTP ${res.status}`);

      const data = (await res.json()) as { data?: { items?: GotoGroup[] } };
      const groups = data.data?.items || [];
      const jobs: RawJob[] = [];
      for (const grp of groups) {
        for (const j of grp.job_list || []) {
          // Only surface roles that are live and publicly listed.
          if (j.state !== 'published') continue;
          if (!(j.distributionChannels || []).includes('public')) continue;
          if (!j.id || !j.text) continue;

          const parts = [j.content?.descriptionHtml || ''];
          for (const l of j.content?.lists || []) {
            if (l.text) parts.push(`<h3>${l.text}</h3>`);
            if (l.content) parts.push(l.content);
          }
          jobs.push({
            company: COMPANY,
            external_id: j.id,
            title: j.text.trim(),
            department: j.categories?.department?.trim() || grp.parent_department?.trim() || null,
            location: j.categories?.location?.trim() || null,
            url: `https://www.gotocompany.com/careers/${j.id}`,
            description_raw: htmlToText(parts.join('\n')) || null,
          });
        }
      }

      if (jobs.length === 0) throw new Error('GoTo API returned zero published roles');
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

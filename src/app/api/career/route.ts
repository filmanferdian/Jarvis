import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const GET = withAuth(async (_req: NextRequest) => {
  const { data: jobs, error } = await supabase
    .from('career_job_watch')
    .select(
      'id, company, external_id, title, department, location, url, status, fit_verdict, fit_score, role_summary, fit_rationale, first_seen, last_seen, closed_at',
    )
    .order('company', { ascending: true })
    .order('last_seen', { ascending: false });

  if (error) {
    console.error('[career/GET] DB error:', error);
    return NextResponse.json({ error: 'Failed to load career jobs' }, { status: 500 });
  }

  // Per-source data-pull health (drives the source-health strip + failure banner).
  const { data: statusRows } = await supabase
    .from('sync_account_status')
    .select('account_key, last_result, last_error, last_synced_at, events_synced')
    .eq('sync_type', 'career-jobs');

  const sources = (statusRows || []).map((s) => ({
    company: s.account_key.replace(/^source:/, ''),
    ok: s.last_result === 'success',
    count: s.events_synced ?? 0,
    error: s.last_error,
    lastSyncedAt: s.last_synced_at,
  }));

  const lastRefreshedAt = (statusRows || []).reduce<string | null>((max, s) => {
    if (!s.last_synced_at) return max;
    return !max || new Date(s.last_synced_at) > new Date(max) ? s.last_synced_at : max;
  }, null);

  return NextResponse.json({ jobs: jobs || [], sources, lastRefreshedAt });
});

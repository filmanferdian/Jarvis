import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') || 'all';

  let query = supabase.from('scanned_contacts').select('*');

  if (filter === 'new') query = query.eq('status', 'new');
  else if (filter === 'existing') query = query.eq('status', 'existing');
  else if (filter === 'synced') query = query.eq('status', 'synced');
  else if (filter === 'ignored') query = query.eq('status', 'ignored');
  else query = query.neq('status', 'ignored'); // 'all' excludes ignored by default

  query = query.order('last_seen_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('[contacts/GET] DB error:', error);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }

  // Compute summary counts
  const all = data || [];
  const summary = {
    total: all.length,
    new_count: all.filter((c) => c.status === 'new').length,
    existing_count: all.filter((c) => c.status === 'existing').length,
    synced_count: all.filter((c) => c.status === 'synced').length,
  };

  const latestUpdated = all.reduce((max, c) => {
    const t = c.updated_at ? new Date(c.updated_at).getTime() : 0;
    return t > max ? t : max;
  }, 0);
  const lastRefreshedAt = latestUpdated > 0 ? new Date(latestUpdated).toISOString() : null;

  return NextResponse.json({ contacts: all, summary, lastRefreshedAt });
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function getWibToday(): string {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + wibOffset).toISOString().split('T')[0];
}

export const GET = withAuth(async (_req: NextRequest) => {
  const date = getWibToday();

  const { data, error } = await supabase
    .from('email_triage')
    .select('*')
    .eq('triage_date', date)
    .order('category', { ascending: true })
    .order('received_at', { ascending: false });

  if (error) {
    console.error('[emails/triage] DB error:', error);
    return NextResponse.json({ error: 'Failed to load email triage' }, { status: 500 });
  }

  const rawRows = data || [];

  // Dedupe rows that represent the same physical email surfacing under multiple
  // (message_id, source) tuples. Same sender + same subject + same minute is
  // treated as the same email; keep the row most likely to be useful.
  const dedupMap = new Map<string, typeof rawRows[number]>();
  for (const r of rawRows) {
    const fromKey = (r.from_address || '').trim().toLowerCase();
    const subjKey = (r.subject || '').trim();
    const minuteKey = Math.floor(new Date(r.received_at).getTime() / 60000);
    const key = `${fromKey}|${subjKey}|${minuteKey}`;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, r);
      continue;
    }
    // Prefer row with a draft, then the most recently created row.
    const existingScore =
      (existing.draft_created ? 1 : 0) * 1e13 + new Date(existing.created_at).getTime();
    const candidateScore =
      (r.draft_created ? 1 : 0) * 1e13 + new Date(r.created_at).getTime();
    if (candidateScore > existingScore) {
      dedupMap.set(key, r);
    }
  }
  const rows = Array.from(dedupMap.values());

  const summary = {
    total: rows.length,
    need_response: rows.filter((r) => r.category === 'need_response').length,
    informational: rows.filter((r) => r.category === 'informational').length,
    newsletter: rows.filter((r) => r.category === 'newsletter').length,
    notification: rows.filter((r) => r.category === 'notification').length,
    automated: rows.filter((r) => r.category === 'automated').length,
    drafts_created: rows.filter((r) => r.draft_created).length,
  };

  const needResponse = rows
    .filter((r) => r.category === 'need_response')
    .map((r) => ({
      from_name: r.from_name,
      from_address: r.from_address,
      subject: r.subject,
      source: r.source,
      draft_created: r.draft_created,
      draft_snippet: r.draft_snippet,
      draft_skipped_reason: r.draft_skipped_reason,
      category_reason: r.category_reason,
      received_at: r.received_at,
      body_snippet: r.body_snippet,
    }));

  const otherEmails = rows
    .filter((r) => r.category !== 'need_response')
    .map((r) => ({
      from_address: r.from_address,
      from_name: r.from_name,
      subject: r.subject,
      category: r.category,
      source: r.source,
      received_at: r.received_at,
    }));

  // Determine latest time slot from most recent created_at
  const latestCreatedAt = rows.reduce((latest, r) => {
    const t = new Date(r.created_at).getTime();
    return t > latest ? t : latest;
  }, 0);
  let latestSlot = 'Morning';
  if (latestCreatedAt > 0) {
    const wib = new Date(latestCreatedAt + 7 * 60 * 60 * 1000);
    const hour = wib.getUTCHours();
    if (hour >= 17 || hour < 5) latestSlot = 'Evening';
    else if (hour >= 11) latestSlot = 'Afternoon';
  }

  const lastRefreshedAt = latestCreatedAt > 0 ? new Date(latestCreatedAt).toISOString() : null;

  return NextResponse.json({ date, latestSlot, lastRefreshedAt, summary, needResponse, otherEmails });
});

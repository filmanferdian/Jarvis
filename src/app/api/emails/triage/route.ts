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

  const rows = data || [];

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

  return NextResponse.json({ date, latestSlot, summary, needResponse, otherEmails });
});

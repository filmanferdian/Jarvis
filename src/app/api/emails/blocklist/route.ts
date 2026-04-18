import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { safeError } from '@/lib/errors';
import { sanitizeInline } from '@/lib/promptEscape';

export const GET = withAuth(async () => {
  const { data, error } = await supabase
    .from('email_draft_blocklist')
    .select('id, pattern, reason, created_at')
    .order('created_at', { ascending: true });

  if (error) return safeError('Failed to load blocklist', error);
  return NextResponse.json({ entries: data || [] });
});

export const POST = withAuth(async (req: NextRequest) => {
  let body: { pattern?: string; reason?: string };
  try {
    body = await req.json();
  } catch (err) {
    return safeError('Invalid JSON', err, 400);
  }

  const pattern = sanitizeInline(body.pattern, 200).toLowerCase();
  const reason = sanitizeInline(body.reason, 500) || null;
  if (!pattern) return NextResponse.json({ error: 'Pattern required' }, { status: 400 });

  const { data, error } = await supabase
    .from('email_draft_blocklist')
    .insert({ pattern, reason })
    .select('id, pattern, reason, created_at')
    .single();

  if (error) return safeError('Failed to add blocklist entry', error);
  return NextResponse.json({ entry: data });
});

export const DELETE = withAuth(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('email_draft_blocklist')
    .delete()
    .eq('id', id);

  if (error) return safeError('Failed to delete blocklist entry', error);
  return NextResponse.json({ ok: true });
});

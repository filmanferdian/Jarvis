import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const { email, name, company } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (company !== undefined) updates.company = company;

    const { error } = await supabase
      .from('scanned_contacts')
      .update(updates)
      .eq('email', email);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: true, email });
  } catch (err) {
    console.error('[contacts/update] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    );
  }
});

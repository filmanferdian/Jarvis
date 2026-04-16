import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const { email, name, company, phone } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (company !== undefined) updates.company = company;
    if (phone !== undefined) updates.phone = phone;

    const { error } = await supabase
      .from('scanned_contacts')
      .update(updates)
      .eq('email', email);

    if (error) {
      console.error('[contacts/update] DB error:', error);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ updated: true, email });
  } catch (err) {
    console.error('[contacts/update] Error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
});

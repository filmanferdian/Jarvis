import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Ignore contacts — remove from triage */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const { emails } = await req.json();

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails[] required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('scanned_contacts')
      .update({ status: 'ignored', updated_at: new Date().toISOString() })
      .in('email', emails)
      .eq('status', 'new');

    if (error) {
      console.error('[contacts/ignore] DB error:', error);
      return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
    }

    return NextResponse.json({ ignored: emails.length });
  } catch (err) {
    console.error('[contacts/ignore] Error:', err);
    return NextResponse.json({ error: 'Ignore failed' }, { status: 500 });
  }
});

/** Restore an ignored contact back to triage */
export const DELETE = withAuth(async (req: NextRequest) => {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('scanned_contacts')
      .update({ status: 'new', updated_at: new Date().toISOString() })
      .eq('email', email)
      .eq('status', 'ignored');

    if (error) {
      console.error('[contacts/ignore] DB error:', error);
      return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
    }

    return NextResponse.json({ restored: true, email });
  } catch (err) {
    console.error('[contacts/ignore] Restore error:', err);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { updateNotionContactFields } from '@/lib/sync/contactScan';

export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { email, name, company, phone } = body;

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

    let notionUpdated: boolean | null = null;
    const { data: row } = await supabase
      .from('scanned_contacts')
      .select('notion_page_id')
      .eq('email', email)
      .maybeSingle();

    if (row?.notion_page_id) {
      try {
        const fields: { name?: string | null; company?: string | null; phone?: string | null } = {};
        if (name !== undefined) fields.name = name;
        if (company !== undefined) fields.company = company;
        if (phone !== undefined) fields.phone = phone;
        notionUpdated = await updateNotionContactFields(row.notion_page_id, fields);
      } catch (err) {
        console.error('[contacts/update] Notion propagate error:', err);
        notionUpdated = false;
      }
    }

    return NextResponse.json({ updated: true, email, notionUpdated });
  } catch (err) {
    console.error('[contacts/update] Error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
});

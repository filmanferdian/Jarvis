import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { createNotionContact } from '@/lib/sync/contactScan';

interface ContactToStore {
  email: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  last_seen_date: string;
}

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const { contacts } = (await req.json()) as { contacts: ContactToStore[] };

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });
    }

    const results: { email: string; success: boolean; notion_page_id?: string }[] = [];

    for (const contact of contacts) {
      try {
        const pageId = await createNotionContact({
          name: contact.name,
          email: contact.email,
          company: contact.company || null,
          phone: contact.phone || null,
          last_seen_date: contact.last_seen_date,
        });

        if (pageId) {
          // Update local cache
          await supabase
            .from('scanned_contacts')
            .update({
              status: 'synced',
              notion_page_id: pageId,
              name: contact.name,
              company: contact.company || null,
              updated_at: new Date().toISOString(),
            })
            .eq('email', contact.email);

          results.push({ email: contact.email, success: true, notion_page_id: pageId });
        } else {
          results.push({ email: contact.email, success: false });
        }
      } catch (err) {
        console.error(`[contacts/store] Failed for ${contact.email}:`, err);
        results.push({ email: contact.email, success: false });
      }
    }

    const synced = results.filter((r) => r.success).length;
    return NextResponse.json({ synced, total: contacts.length, results });
  } catch (err) {
    console.error('[contacts/store] Error:', err);
    return NextResponse.json({ error: 'Store failed' }, { status: 500 });
  }
});

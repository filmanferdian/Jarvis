import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { markSynced } from '@/lib/syncTracker';
import { scanCalendarContacts } from '@/lib/sync/contactScan';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await scanCalendarContacts('weekly');

    await markSynced(
      'contact-scan',
      'success',
      result.new_contacts + result.updated_existing,
    );

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/contact-scan] Error:', msg);
    await markSynced('contact-scan', 'error', 0, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});

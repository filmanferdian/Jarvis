import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { scanCalendarContacts } from '@/lib/sync/contactScan';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const mode = body.mode === 'backfill' ? 'backfill' : 'weekly';

    const result = await scanCalendarContacts(mode);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[contacts/scan] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scan failed' },
      { status: 500 },
    );
  }
});

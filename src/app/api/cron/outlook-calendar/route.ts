import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncOutlookCalendar } from '@/lib/sync/outlookCalendar';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncOutlookCalendar();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Outlook sync error:', err);
    return NextResponse.json(
      { error: 'Outlook sync failed', details: String(err) },
      { status: 500 },
    );
  }
});

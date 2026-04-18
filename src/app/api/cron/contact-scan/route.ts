import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { runCronJob } from '@/lib/cronLog';
import { scanCalendarContacts } from '@/lib/sync/contactScan';

export const GET = withCronAuth(async (_req: NextRequest) => {
  const r = await runCronJob('contact-scan', () => scanCalendarContacts('weekly'), {
    itemsCount: (d) => d.new_contacts + d.updated_existing,
    message: (d) => `new=${d.new_contacts}, updated=${d.updated_existing}`,
  });
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: r.error }, { status: 500 });
});

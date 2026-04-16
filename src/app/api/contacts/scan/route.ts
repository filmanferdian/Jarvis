import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { scanCalendarContacts } from '@/lib/sync/contactScan';
import { ContactsScanSchema } from '@/lib/validation';
import { safeError } from '@/lib/errors';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = ContactsScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await scanCalendarContacts(parsed.data.mode);
    return NextResponse.json(result);
  } catch (err) {
    return safeError('Contacts scan failed', err);
  }
});

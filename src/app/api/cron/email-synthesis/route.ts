import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncEmails } from '@/lib/sync/emailSynthesis';

export const GET = withCronAuth(async (_req: NextRequest) => {
  try {
    const result = await syncEmails();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron: Email synthesis error:', err);
    return NextResponse.json(
      { error: 'Email synthesis failed', details: String(err) },
      { status: 500 },
    );
  }
});

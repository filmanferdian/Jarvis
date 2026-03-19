import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { VERSION } from '@/lib/version';

export async function GET() {
  try {
    const usage = await checkRateLimit();
    return NextResponse.json({ ...usage, version: VERSION.string });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET() {
  try {
    const usage = await checkRateLimit();
    return NextResponse.json(usage);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}

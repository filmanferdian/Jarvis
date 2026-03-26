import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import { VERSION } from '@/lib/version';

const COOKIE_NAME = 'jarvis_session';

function isAuthenticated(req: NextRequest): boolean {
  const expected = process.env.JARVIS_AUTH_TOKEN;
  if (!expected) return false;

  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  const headerToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  const token = cookieToken || headerToken;

  if (!token || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  // Minimal public response for Railway health checks
  if (!isAuthenticated(req)) {
    return NextResponse.json({ status: 'ok' });
  }

  // Authenticated: return full usage details
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

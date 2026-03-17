import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'jarvis_session';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function withAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const expected = process.env.JARVIS_AUTH_TOKEN;
    if (!expected) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    // Check httpOnly cookie first, then fallback to Authorization header (for cron/external callers)
    const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
    const headerToken = req.headers.get('Authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;

    if (!token || !safeCompare(token, expected)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req);
  };
}

export { COOKIE_NAME };

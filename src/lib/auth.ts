import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { assertServerEnv } from './env';

const COOKIE_NAME = 'jarvis_session';

// Single source of truth for session cookie attributes. Login and logout MUST
// use this so `httpOnly`, `sameSite`, `secure`, and `path` cannot drift apart
// (mismatched attributes prevent the browser from clearing the cookie).
export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};
export const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function withAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    // L1: assert JARVIS_AUTH_TOKEN >= 32 chars at first invocation.
    assertServerEnv();

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

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function withCronAuth(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return NextResponse.json({ error: 'Cron auth not configured' }, { status: 500 });
    }
    const secret = req.headers.get('x-cron-secret');
    if (!secret || !safeCompare(secret, expected)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req);
  };
}

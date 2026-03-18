import { NextRequest, NextResponse } from 'next/server';

type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

export function withCronAuth(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    const secret = req.headers.get('x-cron-secret');
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req);
  };
}

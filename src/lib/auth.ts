import { NextRequest, NextResponse } from 'next/server';

export function withAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (token !== process.env.JARVIS_AUTH_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req);
  };
}

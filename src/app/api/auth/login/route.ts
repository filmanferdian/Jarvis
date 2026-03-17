import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const expected = process.env.JARVIS_AUTH_TOKEN;
    if (!expected) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    const valid =
      token.length === expected.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(expected));

    if (!valid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

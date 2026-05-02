import { NextResponse } from 'next/server';
import { COOKIE_NAME, SESSION_COOKIE_OPTS } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTS,
    maxAge: 0,
  });
  return response;
}

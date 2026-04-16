import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/google';
import { createState, setStateCookie } from '@/lib/oauthState';

// GET: Redirect user to Google login for Gmail access.
// Generates a signed OAuth state, sets it in a cookie, and forwards the state to Google
// so the callback can verify it (H1 — CSRF / code-injection protection).
export async function GET() {
  try {
    const { value: state, cookieValue } = createState();
    const authUrl = buildAuthUrl(state);
    const res = NextResponse.redirect(authUrl);
    setStateCookie(res, cookieValue);
    return res;
  } catch (err) {
    console.error('[API Error] Failed to build Google auth URL:', err);
    return NextResponse.json(
      { error: 'Failed to build Google auth URL' },
      { status: 500 },
    );
  }
}

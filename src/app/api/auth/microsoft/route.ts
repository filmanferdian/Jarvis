import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/microsoft';
import { createState, setStateCookie } from '@/lib/oauthState';

// GET: Redirect user to Microsoft login.
// Generates a signed OAuth state (H1 — CSRF / code-injection protection).
export async function GET() {
  try {
    const { value: state, cookieValue } = createState();
    const authUrl = buildAuthUrl(state);
    const res = NextResponse.redirect(authUrl);
    setStateCookie(res, cookieValue);
    return res;
  } catch (err) {
    console.error('[API Error] Failed to build auth URL:', err);
    return NextResponse.json(
      { error: 'Failed to build auth URL' },
      { status: 500 },
    );
  }
}

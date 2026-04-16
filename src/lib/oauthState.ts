import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

// Signed, short-lived OAuth state tokens stored in an httpOnly cookie.
// Protects Google/Microsoft callbacks from CSRF and code-injection attacks.

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const COOKIE_NAME = 'jarvis_oauth_state';

function getSigningKey(): string {
  // Reuse the auth token as HMAC secret — already a 32+ char server-only secret.
  const key = process.env.JARVIS_AUTH_TOKEN;
  if (!key) throw new Error('JARVIS_AUTH_TOKEN required for OAuth state signing');
  return key;
}

function sign(payload: string): string {
  return createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface OAuthStateParts {
  nonce: string;
  issuedAt: number;
}

/** Generate a new OAuth state value. Store its token in a cookie before redirecting. */
export function createState(): { value: string; cookieValue: string } {
  const nonce = randomBytes(16).toString('base64url');
  const issuedAt = Date.now();
  const payload = `${nonce}.${issuedAt}`;
  const sig = sign(payload);
  const cookieValue = `${payload}.${sig}`;
  return { value: nonce, cookieValue };
}

/** Set the signed state cookie on a response before redirecting to the OAuth provider. */
export function setStateCookie(res: NextResponse, cookieValue: string): void {
  res.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // 'strict' would be dropped on cross-site OAuth return
    path: '/',
    maxAge: Math.floor(STATE_TTL_MS / 1000),
  });
}

/** Validate the incoming `state` query param against the signed cookie. Returns true if valid. */
export function verifyState(req: NextRequest, stateParam: string | null): boolean {
  if (!stateParam) return false;
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) return false;

  const parts = cookieValue.split('.');
  if (parts.length !== 3) return false;
  const [nonce, issuedAtStr, sig] = parts;

  // Verify signature
  const expectedSig = sign(`${nonce}.${issuedAtStr}`);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  // Check TTL
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > STATE_TTL_MS) return false;

  // Check nonce matches the query param (timing-safe)
  try {
    const a = Buffer.from(nonce);
    const b = Buffer.from(stateParam);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Clear the state cookie after successful callback to prevent replay. */
export function clearStateCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getUserEmail } from '@/lib/google';
import { supabase } from '@/lib/supabase';
import { verifyState, clearStateCookie } from '@/lib/oauthState';
import { encrypt } from '@/lib/crypto';

// GET: Google OAuth callback — validates state, exchanges code for tokens, stores encrypted.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const code = req.nextUrl.searchParams.get('code');
    const error = req.nextUrl.searchParams.get('error');
    const state = req.nextUrl.searchParams.get('state');

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/?auth=google_error&reason=${encodeURIComponent(error)}`, appUrl),
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/?auth=google_error&reason=no_code', appUrl),
      );
    }

    // H1: reject if state doesn't match the signed cookie set during /api/auth/google
    if (!verifyState(req, state)) {
      console.error('Google OAuth: state verification failed');
      return NextResponse.redirect(
        new URL('/?auth=google_error&reason=invalid_state', appUrl),
      );
    }

    const tokens = await exchangeCodeForTokens(code);
    const email = await getUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Use email as the account ID for multi-account support
    const accountId = email.replace(/[^a-zA-Z0-9]/g, '_');

    const { error: dbError } = await supabase.from('google_tokens').upsert({
      id: accountId,
      email,
      access_token: encrypt(tokens.access_token),
      refresh_token: encrypt(tokens.refresh_token || ''),
      expires_at: expiresAt,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (dbError) {
      console.error('Failed to store Google tokens:', dbError);
      return NextResponse.redirect(
        new URL('/?auth=google_error&reason=db_error', appUrl),
      );
    }

    const res = NextResponse.redirect(
      new URL(`/?auth=google_success&account=${encodeURIComponent(email)}`, appUrl),
    );
    clearStateCookie(res);
    return res;
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(
      new URL('/?auth=google_error&reason=exchange_failed', appUrl),
    );
  }
}

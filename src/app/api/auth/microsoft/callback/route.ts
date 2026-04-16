import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/microsoft';
import { supabase } from '@/lib/supabase';
import { verifyState, clearStateCookie } from '@/lib/oauthState';
import { encrypt } from '@/lib/crypto';

// GET: Microsoft OAuth callback — validates state, exchanges code for tokens, stores encrypted.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const code = req.nextUrl.searchParams.get('code');
    const error = req.nextUrl.searchParams.get('error');
    const errorDescription = req.nextUrl.searchParams.get('error_description');
    const state = req.nextUrl.searchParams.get('state');

    if (error) {
      console.error('Microsoft OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/?auth=microsoft_error&reason=${encodeURIComponent(error)}`, appUrl),
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/?auth=microsoft_error&reason=no_code', appUrl),
      );
    }

    // H1: reject if state doesn't match the signed cookie set during /api/auth/microsoft
    if (!verifyState(req, state)) {
      console.error('Microsoft OAuth: state verification failed');
      return NextResponse.redirect(
        new URL('/?auth=microsoft_error&reason=invalid_state', appUrl),
      );
    }

    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: dbError } = await supabase.from('microsoft_tokens').upsert({
      id: 'default',
      access_token: encrypt(tokens.access_token),
      refresh_token: encrypt(tokens.refresh_token || ''),
      expires_at: expiresAt,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (dbError) {
      console.error('Failed to store tokens:', dbError);
      return NextResponse.redirect(
        new URL('/?auth=microsoft_error&reason=db_error', appUrl),
      );
    }

    const res = NextResponse.redirect(new URL('/?auth=microsoft_success', appUrl));
    clearStateCookie(res);
    return res;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      new URL('/?auth=microsoft_error&reason=exchange_failed', appUrl),
    );
  }
}

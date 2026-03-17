import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/google';

// GET: Redirect user to Google login for Gmail access
export async function GET() {
  try {
    const authUrl = buildAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to build Google auth URL', details: String(err) },
      { status: 500 },
    );
  }
}

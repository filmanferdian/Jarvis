import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/microsoft';

// GET: Redirect user to Microsoft login
export async function GET() {
  try {
    const authUrl = buildAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('[API Error] Failed to build auth URL:', err);
    return NextResponse.json(
      { error: 'Failed to build auth URL' },
      { status: 500 },
    );
  }
}

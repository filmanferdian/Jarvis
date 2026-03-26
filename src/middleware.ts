import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limiting (resets on deploy, acceptable for single-user app)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const start = Date.now();

  // Content-Type enforcement for mutating API requests (CSRF protection)
  // Forms can POST cross-origin without CORS preflight; requiring JSON blocks this vector
  if (
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH'].includes(req.method) &&
    !pathname.startsWith('/api/auth/google') &&
    !pathname.startsWith('/api/auth/microsoft')
  ) {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 },
      );
    }
  }

  // Rate limiting for auth login (brute force protection)
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    if (!checkRateLimit('login', 5, 60_000)) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429 },
      );
    }
  }

  // Rate limiting for weight webhook (spam protection)
  if (pathname === '/api/health/weight' && req.method === 'POST') {
    if (!checkRateLimit('weight', 10, 3600_000)) {
      return NextResponse.json(
        { error: 'Too many weight submissions. Try again later.' },
        { status: 429 },
      );
    }
  }

  // Rate limiting for AI endpoints (burst protection)
  if (pathname.startsWith('/api/voice/') && req.method === 'POST') {
    if (!checkRateLimit('voice', 20, 60_000)) {
      return NextResponse.json(
        { error: 'Too many AI requests. Try again later.' },
        { status: 429 },
      );
    }
  }

  const response = NextResponse.next();

  // Structured request logging (Railway captures stdout)
  // Skip health endpoint to reduce noise
  if (pathname.startsWith('/api/') && pathname !== '/api/health') {
    response.headers.set('x-request-start', String(start));

    // Log after response (best-effort, since edge middleware can't await response)
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: pathname,
      }),
    );
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

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

// M3: CSP retains 'self' allowlist + per-request nonce. 'unsafe-inline' is kept
// alongside the nonce because Next.js 16 with the deprecated `middleware` file
// convention does NOT reliably stamp the nonce on its auto-emitted inline
// hydration scripts in production builds. Without 'unsafe-inline', those
// scripts are blocked and the app can't hydrate.
//
// CSP Level 3 behavior: when a nonce is present, modern browsers IGNORE
// 'unsafe-inline' for inline scripts (the nonce takes precedence). So if we
// later migrate to the new `proxy` convention and Next.js starts stamping the
// nonce properly, this CSP automatically tightens without code change.
// Old browsers (pre-CSP-L3) keep working via the 'unsafe-inline' fallback.
//
// What we still prevent:
//  - External script injection from unknown domains (only 'self' is allowed)
//  - frame-ancestors attacks
//  - form-action hijacking
// What we don't prevent (until Next.js fixes nonce stamping or we move to proxy):
//  - Inline <script> XSS in modern browsers is tightened by the nonce, but
//    only for inline scripts Next.js stamps. User-rendered inline scripts
//    (which shouldn't exist given C3 renderMarkdown HTML-escapes) would
//    still execute in older browsers.
function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.openai.com https://api.elevenlabs.io",
    "media-src 'self' blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const start = Date.now();
  const isApi = pathname.startsWith('/api/');

  // Content-Type enforcement for mutating API requests (CSRF protection)
  // Forms can POST cross-origin without CORS preflight; requiring JSON blocks this vector
  if (
    isApi &&
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

  // Generate a CSP nonce for HTML responses. Next.js reads `x-nonce` from the
  // inbound request and stamps its own inline scripts with that value.
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const cspHeader = buildCspHeader(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Attach CSP only to non-API responses (HTML). API responses don't execute
  // scripts in the browser, so the nonce has no meaning there.
  if (!isApi) {
    response.headers.set('Content-Security-Policy', cspHeader);
  }

  // L2: cron endpoints are GETs — prevent any CDN/proxy from caching and replaying them.
  if (pathname.startsWith('/api/cron/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
  }

  // Structured request logging (Railway captures stdout)
  // Skip health endpoint to reduce noise
  if (isApi && pathname !== '/api/health') {
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
  // Run on everything except static assets and Next.js internal paths. This
  // lets the CSP nonce reach HTML responses while keeping the asset pipeline
  // untouched.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|otf|eot|map)$).*)',
  ],
};

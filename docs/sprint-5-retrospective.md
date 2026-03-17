# Sprint 5 Retrospective

**Sprint dates:** 2026-03-17
**Status:** Complete

---

## What was delivered

### P0 — Security Hardening

| Feature | Files | Status |
|---------|-------|--------|
| Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection) | `next.config.ts` | Done |
| httpOnly cookie auth (replaced localStorage) | `src/lib/auth.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts` | Done |
| Timing-safe token comparison | `src/lib/auth.ts` (crypto.timingSafeEqual) | Done |
| Zod input validation | `src/lib/validation.ts` + tasks/create, tasks/update, voice/intent, tts routes | Done |
| Error response sanitization | All 9 routes with `details: String(err)` fixed | Done |
| localStorage elimination | 8 components migrated to `credentials: 'include'` cookie auth | Done |

### P1 — Monitoring & Stability

| Feature | Files | Status |
|---------|-------|--------|
| Request logging middleware | `src/middleware.ts` (structured JSON to stdout) | Done |
| Auth rate limiting (5/min login, 10/hr weight webhook) | `src/middleware.ts` | Done |
| Cron run logging table + helper | `src/lib/cronLog.ts`, `supabase/migration-007-sprint5.sql` | Done |
| Cron status endpoint | `src/app/api/cron/status/route.ts` | Done |
| npm audit | 0 vulnerabilities confirmed | Done |

### P2 — Jarvis Identity & UX

| Feature | Files | Status |
|---------|-------|--------|
| TTS voice upgrade — tts-1-hd, fable (British), 0.95x speed | `src/app/api/tts/route.ts` | Done |
| Briefing Jarvis persona — British butler, spoken-word style, ~450 words | `src/app/api/briefing/regenerate/route.ts` | Done |
| Arc reactor PWA icons (SVG + 192px + 512px + favicon) | `public/icons/icon.svg`, `icon-192.png`, `icon-512.png`, `public/favicon.png` | Done |

## What went well

1. **Security audit drove clear priorities** — Identifying concrete gaps (localStorage XSS, error leaks, no headers) made implementation focused and measurable.
2. **httpOnly cookie migration was smooth** — All 8 components using localStorage were migrated in one pass. The `withAuth` fallback to Authorization header preserved backward compatibility for cron-job.org.
3. **Zod integration was clean** — Schema validation replaces ad-hoc `if (!name)` checks with type-safe parsing. Error messages are automatically descriptive.
4. **Zero vulnerabilities** — `npm audit --production` reports 0 issues across all 60 packages.
5. **Arc reactor icon looks great** — SVG-based approach with sharp conversion produces crisp icons at all sizes.

## What went wrong

1. **Next.js 16 middleware deprecation warning** — `src/middleware.ts` triggers a warning: "The middleware file convention is deprecated. Please use proxy instead." The middleware still works, but may need migration in future Next.js versions.
2. **Build requires .env.local in worktree** — TypeScript compilation succeeds but page data collection fails without Supabase URL. Must copy `.env.local` to worktrees.

## Lessons

- Security hardening for a single-user app should focus on browser-side protections (httpOnly cookies, CSP, input validation) rather than enterprise patterns (JWT, RLS policies, key rotation)
- The httpOnly + SameSite=Strict cookie pattern provides both XSS protection and CSRF protection in one mechanism
- Next.js `headers()` in config is the simplest way to add security headers — no middleware needed for static headers

## Key metrics

- **API routes:** 34 (was 31 in Sprint 4, +3: login, logout, cron/status)
- **Supabase tables:** 15 (was 14, +1: cron_run_log)
- **Security headers:** 7 (was 0)
- **localStorage references:** 0 (was 10)
- **Error detail leaks:** 0 (was 9 routes)
- **Input validation schemas:** 7 (was 0)
- **npm vulnerabilities:** 0
- **Dependencies:** +1 (zod)

# Sprint 6 Handover

**Prepared:** 2026-03-17
**Previous sprint:** Sprint 5 (Security Hardening + Jarvis Identity)

---

## What was delivered

### P0 — Security Hardening

| Feature | Files | Status |
|---------|-------|--------|
| Security headers (CSP, HSTS, X-Frame-Options, etc.) | `next.config.ts` | Done |
| httpOnly cookie auth (replaced localStorage) | `src/lib/auth.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts` | Done |
| Timing-safe token comparison | `src/lib/auth.ts` (crypto.timingSafeEqual) | Done |
| Zod input validation | `src/lib/validation.ts` + 4 mutation routes | Done |
| Error response sanitization | All 9 routes with `details: String(err)` fixed | Done |
| All localStorage references removed | 8 components migrated to cookie auth | Done |

### P1 — Monitoring & Stability

| Feature | Files | Status |
|---------|-------|--------|
| Request logging middleware | `src/middleware.ts` | Done |
| Auth rate limiting (5/min login, 10/hr weight) | `src/middleware.ts` | Done |
| Cron run logging | `src/lib/cronLog.ts`, `supabase/migration-007-sprint5.sql` | Done |
| Cron status endpoint | `src/app/api/cron/status/route.ts` | Done |
| npm audit | 0 vulnerabilities | Verified |

### P2 — Jarvis Identity & UX

| Feature | Files | Status |
|---------|-------|--------|
| TTS voice upgrade (tts-1-hd, fable, 0.95x) | `src/app/api/tts/route.ts` | Done |
| Briefing Jarvis persona (British butler, spoken-word) | `src/app/api/briefing/regenerate/route.ts` | Done |
| Arc reactor PWA icons (192, 512, favicon) | `public/icons/icon.svg`, `icon-192.png`, `icon-512.png`, `public/favicon.png` | Done |

---

## Security changes summary

### Before Sprint 5
- Token in localStorage (XSS-vulnerable)
- Simple `===` comparison for auth
- No security headers
- Error responses leaking internal details
- No input validation library
- No request logging or rate limiting

### After Sprint 5
- Token in httpOnly Secure SameSite=Strict cookie
- `crypto.timingSafeEqual()` for all token comparisons
- 7 security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection)
- All error responses sanitized (log server-side, return generic message)
- Zod schemas for all mutation endpoints
- Request logging via middleware, brute force protection on login

---

## New routes

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/auth/login` | POST | Set httpOnly session cookie | None (validates token) |
| `/api/auth/logout` | POST | Clear session cookie | None |
| `/api/cron/status` | GET | Cron job health dashboard | Bearer/Cookie |

---

## New files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Request logging + rate limiting |
| `src/lib/validation.ts` | Zod schemas for all API inputs |
| `src/lib/errors.ts` | Safe error response helper |
| `src/lib/cronLog.ts` | Cron run logging helper |
| `src/app/api/auth/login/route.ts` | Login + set httpOnly cookie |
| `src/app/api/auth/logout/route.ts` | Logout + clear cookie |
| `src/app/api/cron/status/route.ts` | Cron health status |
| `supabase/migration-007-sprint5.sql` | `cron_run_log` table |
| `public/icons/icon.svg` | Arc reactor SVG icon |
| `public/favicon.png` | Arc reactor favicon |

---

## Dependencies added

- `zod` — input validation

---

## Migration needed

Run `supabase/migration-007-sprint5.sql` to create the `cron_run_log` table.

---

## Critical gotchas (carry forward)

1. **ANTHROPIC_API_KEY conflict** — Use `JARVIS_ANTHROPIC_KEY || ANTHROPIC_API_KEY`.
2. **Dual .env.local** — Both repo root and worktree need `.env.local`.
3. **Delete-then-insert** — Single-row-per-day tables use delete + insert.
4. **Google OAuth** — Always use `prompt: 'consent'`.
5. **Railway port** — App listens on `$PORT` (8080). Domain networking must match.
6. **Garmin raw_json** — Always store raw API responses.
7. **iOS Shortcuts payloads** — Accept multiple data formats.
8. **WIB timezone** — All times use hardcoded offset `7 * 60 * 60 * 1000` (UTC+7).
9. **Cookie auth** — Browser uses httpOnly cookie, external callers (cron-job.org) use `x-cron-secret` header.
10. **Next.js 16 middleware warning** — "middleware" convention is deprecated, Next.js recommends "proxy". Still works but may need migration in future.

---

## Notion page IDs for updates

| Page | ID |
|------|-----|
| Sprint logs | `322c674aecec8193954acb0648fbddb0` |
| Retrospective log | `322c674aecec81de9e85f5dceca130ae` |
| Project Jarvis | `322c674aecec81c2986cef59e388c8f4` |
| Delivery | `322c674aecec81b793d4d69e163b0a23` |

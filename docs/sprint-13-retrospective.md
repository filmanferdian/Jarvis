# Sprint 13 Retrospective

**Version:** v2.2.12 → v2.3.1
**Date:** 2026-03-26
**Theme:** Security Hardening + Health Automation + Speaking Mode

## Delivery Summary

- **Security hardening (v2.3.0)** — 7 fixes: timing-safe cron auth, health endpoint protection, CSP tightening, ElevenLabs CSP allowlist, AI endpoint rate limiting, Content-Type enforcement, log sanitization
- **10k run auto-detection** — Garmin sync now detects runs >=9.5km and records fastest time to health_measurements for OKR tracking
- **Blood work entry UI** — Tab-based ManualEntryForm with Measurement/Blood Work modes, pre-filled reference ranges for HbA1c, glucose, triglycerides, HDL, testosterone
- **Full-screen speaking overlay** — SpeakingContext + SpeakingOverlay: cinematic ArcReactor during TTS playback, tap-to-dismiss
- **ArcReactor mobile optimization** — 30fps throttle, 2 max sparks, simplified rendering on screens <768px
- **Legacy cleanup** — Removed dead JarvisOrb CSS keyframes and utility classes

## Key Decisions

1. **Split health endpoint** — Unauthenticated `/api/health` returns `{ status: "ok" }` for Railway health checks; full usage data requires auth. Avoids exposing version and API quota publicly.
2. **Content-Type enforcement in middleware** — POST/PUT/PATCH to API routes require `application/json`. Blocks CSRF via form-encoded requests. Exempted OAuth callback routes.
3. **Removed `unsafe-eval` from CSP** — Next.js App Router doesn't need it in production. Kept `unsafe-inline` (required for Next.js).
4. **SpeakingContext over prop drilling** — Global context for speaking state allows any TTS button to trigger the overlay without threading props through the component tree.
5. **10k detection uses >=9.5km threshold** — Accounts for GPS drift on 10k runs. Records fastest qualifying run per activity sync.
6. **Blood work reference ranges pre-filled** — Users don't need to remember reference ranges for common markers. Defaults from standard lab reference values.
7. **ArcReactor 30fps on mobile** — Full 60fps unnecessary for small canvas sizes. Halving frame rate saves battery without visible quality loss.

## What Went Well

1. **Security audit was thorough** — Found 7 concrete issues across auth, CSP, rate limiting, logging. All fixed in one commit.
2. **Existing infrastructure supported new features** — Trends API, health_measurements table, blood-work API all existed. New features just wired into them.
3. **Speaking overlay pattern is clean** — Context + overlay + stop-function registration is a reusable pattern for any future full-screen states.

## What Could Improve

1. **Worktree .env.local gap** — Couldn't fully test authenticated pages in dev preview. Production deploy is the real test.
2. **Sprint 10 retro was already done** — Handover listed it as P0 carry-forward but it existed since Sprint 10. Should clean up stale handover items.

## Metrics

- **Versions deployed:** 2 (v2.3.0 security, v2.3.1 features)
- **Files changed:** 14 (5 security + 9 features)
- **New files:** 2 (SpeakingContext.tsx, SpeakingOverlay.tsx)
- **Lines added:** ~430, removed: ~100
- **Dead CSS removed:** 4 keyframes, 4 utility classes
- **Security fixes:** 7

# Sprint 14 Handover

## Sprint 13 Summary (v2.3.1)

Sprint 13 delivered security hardening (7 fixes), 10k run auto-detection from Garmin, blood work entry UI streamlining, full-screen ArcReactor speaking overlay, mobile ArcReactor optimization, and legacy JarvisOrb cleanup.

### Current State
- **Version:** 2.3.1 deployed on Railway
- **Security:** Timing-safe cron auth, protected health endpoint, tightened CSP (no unsafe-eval), Content-Type enforcement, AI endpoint rate limiting
- **10k run detection:** Garmin sync auto-records fastest run >=9.5km to health_measurements
- **Blood work entry:** Tab-based form in ManualEntryForm with pre-filled reference ranges
- **Speaking overlay:** Full-screen cinematic ArcReactor during TTS, tap-to-dismiss
- **ArcReactor mobile:** 30fps throttle, reduced sparks on <768px screens
- **All Sprint 12 systems unchanged:** Email triage, contact scanner, OKR page, cron jobs

### Files Changed in Sprint 13

**Security Hardening (v2.3.0):**
- `src/lib/cronAuth.ts` — timing-safe comparison with `timingSafeEqual`
- `src/app/api/health/route.ts` — split public/authenticated response
- `next.config.ts` — removed `unsafe-eval`, added ElevenLabs to `connect-src`
- `src/middleware.ts` — Content-Type enforcement, `/api/voice/*` rate limiting (20 req/min)
- `src/app/api/health/weight/route.ts` — sanitized raw body logging, removed body from error response

**10k Run Auto-Detection:**
- `src/lib/sync/garmin.ts` — 10k detection after activity upsert (~line 450)

**Blood Work Entry UI:**
- `src/components/health/ManualEntryForm.tsx` — full rewrite with Measurement/Blood Work tabs

**Speaking Overlay:**
- `src/contexts/SpeakingContext.tsx` — new: global speaking state context
- `src/components/SpeakingOverlay.tsx` — new: full-screen overlay with ArcReactor
- `src/components/TTSButton.tsx` — integrated SpeakingContext (setSpeaking, registerStopFn)
- `src/components/AppShell.tsx` — mounted SpeakingProvider + SpeakingOverlay

**ArcReactor Mobile Optimization:**
- `src/components/ArcReactor.tsx` — mobile detection, 30fps throttle, simplified rendering

**Legacy Cleanup:**
- `src/app/globals.css` — removed orb-breathe, orb-speak, orb-listen, orb-think keyframes and classes

### No New Env Vars

### No New Migrations

### No DB Changes

### Cron Jobs (unchanged from Sprint 12)
| Job | URL | Schedule | Header |
|-----|-----|----------|--------|
| Google Calendar | `/api/cron/google-calendar` | Every 1 hour | x-cron-secret |
| Outlook Calendar | `/api/cron/outlook-calendar` | Every 1 hour | x-cron-secret |
| Garmin | `/api/cron/garmin` | Every 3 hours | x-cron-secret |
| Notion Tasks | `/api/cron/notion-tasks` | Every 3 hours | x-cron-secret |
| Email Synthesis + Triage | `/api/cron/email-synthesis` | 7am, 1pm, 7pm WIB | x-cron-secret |
| Morning Briefing | `/api/cron/morning-briefing` | Daily 7:30 WIB | x-cron-secret |
| Fitness | `/api/cron/fitness` | Weekly Sunday 18:00 | x-cron-secret |
| Notion Context | `/api/cron/notion-context` | Every 2 weeks | x-cron-secret |
| Contact Scan | `/api/cron/contact-scan` | Weekly Sunday | x-cron-secret |

## Sprint 14 Progress

### Completed — Fitness Program Schedule Fix + Migration

**Problem:** The Notion "Program Schedule" database had two data integrity issues:
1. Day numbers off by +7 after Day 49 (Days 50-56 missing, causing gap)
2. All Wednesday and Saturday cardio entries stored as "walk" instead of "run", with wrong durations

**Fix applied:**
- Created `scripts/fix-fitness-schedule.mjs` to batch-update 345 Notion pages (corrected day labels and cardio values)
- Created `program_schedule` Supabase table (364 rows) as the new source of truth
- Rewrote `src/lib/sync/fitness.ts` to read from `program_schedule` instead of Notion API

**Impact:**
- Fitness sync no longer depends on Notion API (faster, no external call)
- Cardio data now correctly shows runs for Wed/Sat (e.g., "55min Z2 run" for Week 9 Saturday)
- Change detection simplified: skips re-sync if already synced today (WIB date), unless forced

**Files changed:**
- `src/lib/sync/fitness.ts` — full rewrite (74 insertions, 162 deletions)
- `scripts/fix-fitness-schedule.mjs` — new one-time Notion fix script

**New table:** `program_schedule` (created manually in Supabase)
- Primary key: `day_number` (integer)
- Columns: date, day_of_week, week, phase, day_type, training, cardio, deload, calories, protein, carbs, fat, steps_target, eating_open, eating_close, optional_evening_cardio

## Sprint 14 Candidates

### P0 — Carry-Forward
1. **Verify current events synthesis quality** — check newsletter distillation over real data
2. **OKR baselines remaining** — 6 KRs still missing baselines (blood work / manual metrics scheduled for Apr 1)
3. **Trend sparkline charts** — deferred from Sprint 13; 7-day mini charts for each OKR metric on `/health` page

### P1 — Observability
4. **Security monitoring dashboard** — show rate limit hits, auth failures, CSP violations in `/utilities`
5. **Garmin sync health visibility** — surface circuit breaker state, last sync time, API budget remaining

### P1 — Speaking Mode
6. **Voice command improvements** — refine voice intent parsing, add more command types
7. **Speaking overlay enhancements** — waveform visualization, briefing progress indicator

### P2 — Polish
8. **Nonce-based CSP** — replace `unsafe-inline` with nonce for stronger XSS protection
9. **Mobile dashboard layout** — optimize card grid for small screens

## Gotchas

1. **Content-Type enforcement exemptions** — OAuth callback routes (`/api/auth/google`, `/api/auth/microsoft`) are exempt from JSON Content-Type requirement since they use form-encoded redirects.
2. **10k run detection threshold** — uses >=9500 meters (not exactly 10000) to account for GPS drift. Only filters activities with `activity_type` containing 'run'.
3. **10k run records fastest, not latest** — if multiple qualifying runs exist in the same sync batch, the fastest (lowest duration_seconds) is recorded.
4. **Blood work reference ranges** — pre-filled defaults in ManualEntryForm; actual ranges should match the specific lab's reference values.
5. **SpeakingContext stop function** — TTSButton registers its `stopPlayback` via `registerStopFn`. If multiple TTSButtons exist, only the last one's stop function is registered (single active player assumption).
6. **ArcReactor mobile detection is per-mount** — checks `window.innerWidth < 768` on component mount. Doesn't react to resize events (acceptable for mobile-vs-desktop detection).
7. **ArcReactor full size exempt from mobile throttle** — the speaking overlay uses `size='full'` which bypasses the 30fps throttle and simplified rendering, keeping the cinematic quality.
8. **Health endpoint dual response** — unauthenticated returns `{ status: "ok" }`, authenticated returns full usage data + version. Railway health checks use unauthenticated path.
9. **Rate limit on voice endpoints** — 20 requests per 60 seconds window. In-memory, resets on deploy. Separate from the daily 50-call API usage limit.
10. **CSP connect-src includes ElevenLabs** — `https://api.elevenlabs.io` added for client-side TTS streaming. If TTS provider changes, update CSP.

## Voice Configuration (unchanged)
- **Voice:** Christopher (`G17SuINrv2H9FC6nvetn`) from ElevenLabs library
- **Model:** `eleven_multilingual_v2` (NOT turbo — turbo degrades voice quality)
- **Settings:** stability 0.75, similarity_boost 0.8, style 0
- **Env var:** `ELEVENLABS_VOICE_ID=G17SuINrv2H9FC6nvetn` on Railway

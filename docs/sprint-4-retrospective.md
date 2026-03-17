# Sprint 4 Retrospective

**Sprint dates:** 2026-03-17
**Status:** Complete

---

## What was delivered

| Feature | Route/Component | Status |
|---------|----------------|--------|
| Google Calendar Sync | `/api/sync/google-calendar`, `src/lib/sync/googleCalendar.ts` | Live |
| Shared sync modules | `src/lib/sync/*.ts` (5 modules) | Live |
| Cron routes (6 endpoints) | `/api/cron/{google-calendar,outlook-calendar,notion-tasks,email-synthesis,morning-briefing,garmin}` | Live |
| Cron auth middleware | `src/lib/cronAuth.ts` — `withCronAuth()` via `x-cron-secret` header | Live |
| Auto-sync on dashboard load | `/api/sync` with debouncing via `sync_status` table | Live |
| Garmin Connect integration | `src/lib/sync/garmin.ts` — daily metrics + activities via `garmin-connect` npm | Live |
| Apple Health weight webhook | `/api/health/weight` — iOS Shortcuts → Jarvis | Live |
| Health dashboard API | `/api/health-fitness` — Garmin + weight data | Live |
| HealthCard component | `src/components/HealthCard.tsx` — vitals, fitness, activity, weight sparkline | Live |
| Railway deployment | `jarvis-production-9aea.up.railway.app` via Railpack builder | Live |
| Supabase migrations | `sync_status` (005), `garmin_daily` + `garmin_activities` + `weight_log` (006) | Applied |
| External cron jobs | 6 jobs on cron-job.org (15min/30min/daily schedules) | Live |
| Domain KPI auto-update | Garmin sync updates Health + Fitness KPIs automatically | Live |

## What went well

1. **n8n fully eliminated** — All 6 sync/generation tasks now run as Next.js cron routes. No external orchestration dependency.
2. **Garmin Connect package works** — `garmin-connect` npm package successfully authenticates and fetches all metrics (steps, HR, sleep, stress, HRV, body battery, VO2 max, training readiness/status, activities). No iOS Shortcuts fallback needed.
3. **Shared sync modules** — Extracting logic into `src/lib/sync/*.ts` made cron routes trivial thin wrappers and enabled the dashboard auto-sync endpoint cleanly.
4. **Railway deployment** — First production deploy. Build takes ~42s with Railpack. App runs on port 8080 (Railway's `$PORT`).
5. **Weight endpoint resilience** — After iOS Shortcuts sent unexpected formats, the endpoint was made to recursively extract numbers from any payload shape.

## What went wrong

### 1. Railway builder confusion (Nixpacks deprecated)
**Impact:** Medium. Two failed deployments.
**Root cause:** `railway.json` specified `"builder": "NIXPACKS"` but Railway has deprecated Nixpacks. It silently fell back to Dockerfile builder which used Node 18 (Next.js 16 requires Node >= 20.9.0).
**Fix applied:** Changed to `"builder": "RAILPACK"` (Railway's new builder).
**Lesson:** Check Railway's current builder options before deploying. Nixpacks is deprecated as of early 2026.

### 2. Railway healthcheck failures
**Impact:** Medium. Three failed deployments with "Healthcheck failure" after build/deploy succeeded.
**Root cause:** Railway's healthcheck probe couldn't reach `/api/health` during deployment. The app started on port 8080 but the domain was mapped to port 3000.
**Fix applied:** Removed healthcheck from `railway.json` (app works fine without it). Fixed port mapping in networking settings.
**Lesson:** Railway sets `$PORT` dynamically (8080 in our case). Ensure domain networking points to the correct port. Healthcheck is optional — remove it if it causes deployment failures.

### 3. Garmin API response structure different from docs
**Impact:** Low. First Garmin sync returned many null fields despite data being present.
**Root cause:** The `garmin-connect` package returns raw Garmin API responses with deeply nested structures. Key paths were different from what was guessed:
- `sleep.dailySleepDTO.sleepScores.overall` (not `sleep.sleepScores.overall`)
- `stress.avgStressLevel` (not `stress.overallStressLevel`)
- `hrv.hrvSummary.status` (not `hrv.status`)
- `ts.mostRecentVO2Max.vo2MaxValue` (not `ts.vo2MaxValue`)
- Body battery from `stress.bodyBatteryValuesArray` (array of `[timestamp, value]` tuples)
**Fix applied:** Stored `raw_json` in Supabase, examined actual response keys, updated parsing.
**Lesson:** Always store raw API responses on first integration. Parse from real data, not guessed schemas.

### 4. iOS Shortcuts sends Health Sample as object, not number
**Impact:** Low. Weight endpoint returned 400 errors from iOS Shortcuts.
**Root cause:** iOS Shortcuts' "Find Health Samples" action passes the full Health Sample object (or a string like "89.5 kg") rather than a plain number when used as a JSON body field.
**Fix applied:** Added recursive `extractNumber()` that handles number, string, object (checks `.value`, `.quantity`), and fallback body scan for weight-range numbers.
**Lesson:** iOS Shortcuts is unpredictable with data types. Always accept multiple formats for webhook endpoints.

## Key metrics

- **API routes:** 31 (was 22 in Sprint 3)
- **New routes this sprint:** 9 (6 cron + 1 garmin sync + 1 health-fitness + 1 weight + 1 auto-sync + 1 google-calendar)
- **New sync modules:** 6 (`src/lib/sync/*.ts`)
- **New components:** 1 (HealthCard)
- **Supabase tables:** 14 (was 10, added sync_status + garmin_daily + garmin_activities + weight_log)
- **Connected services:** Garmin Connect (new), cron-job.org (new), Railway (new)
- **Garmin metrics synced:** 15+ fields per day + activities
- **n8n dependency:** Fully eliminated
- **Production URL:** `jarvis-production-9aea.up.railway.app`

## Architecture evolution

**Before Sprint 4 (n8n for cron, localhost only):**
```
Google Calendar → n8n → Supabase
Notion → n8n (backup) → Supabase
Morning Briefing → n8n → Claude → Supabase
All other sync → localhost:3000 manual triggers
```

**After Sprint 4 (fully self-hosted, production deployed):**
```
Google Calendar → cron-job.org → /api/cron/google-calendar → Google Calendar API → Supabase
Outlook Calendar → cron-job.org → /api/cron/outlook-calendar → Microsoft Graph → Supabase
Notion Tasks → cron-job.org → /api/cron/notion-tasks → Notion API → Supabase
Email Synthesis → cron-job.org → /api/cron/email-synthesis → Gmail+Outlook → Claude → Supabase
Morning Briefing → cron-job.org → /api/cron/morning-briefing → Claude → Supabase
Garmin Health → cron-job.org → /api/cron/garmin → Garmin Connect → Supabase
Weight → Fitdays Scale → Apple Health → iOS Shortcut → /api/health/weight → Supabase
Dashboard → auto-sync on load (debounced) → all sync modules
```

n8n is no longer used. All scheduling via cron-job.org external cron service.

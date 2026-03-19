# Sprint 8 Handover

## Sprint 7 Summary (v1.7.0)

Sprint 7 delivered the Health & Fitness OKR dashboard, Utilities page, versioning system, and voiceover persona refinement. 32 files changed, ~2,200 lines added, 4 new tables, 2 new pages, 10 new API routes.

### Current State
- **Version:** 1.7.0 deployed on Railway
- **New pages:** `/health` (OKR dashboard), `/utilities` (API usage + integration health)
- **New integrations:** Apple Health webhook expansion (body fat, waist, BP, lean body mass)
- **Garmin session caching:** implemented but initial backfill blocked by Cloudflare rate limit
- **Voiceover:** Alfred/British butler persona active in briefing + email synthesis prompts

### New Env Vars
None added in Sprint 7 (all new features use existing env vars).

### Migration
`supabase/migration-010-sprint7.sql` — applied. Creates:
- `health_measurements` — manual/Apple Health body metrics
- `blood_work` — lab results with reference ranges
- `okr_targets` — seeded with all 5 objectives and 23 key results
- `api_usage_v2` — per-service daily tracking
- `baseline_snapshot` column on `briefing_cache`
- `garmin-tokens` sync_status row for session caching

### Cron Jobs (cron-job.org)
| Job | URL | Schedule | Header |
|-----|-----|----------|--------|
| Google Calendar | `/api/cron/google-calendar` | Every 1 hour | x-cron-secret |
| Outlook Calendar | `/api/cron/outlook-calendar` | Every 1 hour | x-cron-secret |
| Garmin | `/api/cron/garmin` | Every 3 hours | x-cron-secret |
| Notion Tasks | `/api/cron/notion-tasks` | Every 3 hours | x-cron-secret |
| Email Synthesis | `/api/cron/email-synthesis` | Every 6 hours | x-cron-secret |
| Morning Briefing | `/api/cron/morning-briefing` | Daily 7:30 WIB | x-cron-secret |
| **Fitness (NEW)** | `/api/cron/fitness` | Weekly Sunday 18:00 | x-cron-secret |

### Apple Health Shortcuts (iOS)
4 shortcuts configured, all POST to `/api/health/measurements` with `Authorization: Bearer <JARVIS_AUTH_TOKEN>`:
- Body Fat % → `measurement_type: "body_fat"`
- Blood Pressure Systolic → `measurement_type: "blood_pressure_systolic"`
- Blood Pressure Diastolic → `measurement_type: "blood_pressure_diastolic"`
- Waist Circumference → `measurement_type: "waist_circumference"`

## Sprint 8 Candidates

### P0 — Carry-Forward
1. **Garmin 56-day backfill** — retry `POST /api/sync/garmin/backfill` once Cloudflare rate limit clears. Verify session caching works end-to-end.
2. **Verify Garmin cron** — confirm the 3-hour cron job succeeds with session caching (no more 500 errors).

### P1 — Health & Fitness Enhancements
3. **Trend sparkline charts** — `TrendSparkline.tsx` SVG component for the `/health` page. Data API already exists (`GET /api/health-fitness/trends`).
4. **AI-generated health insights** — Claude analyzes 7-day data and surfaces observations on the `/health` page (stale data warnings, pace-to-target, weekly averages).
5. **Training adherence auto-calc** — count Garmin activities vs expected sessions from `fitness_context`.
6. **10k time auto-detection** — parse `garmin_activities` for runs ≥9.5km, extract elapsed time.
7. **Quarterly blood work reminder** — briefing alert when next Prodia panel is due per schedule.

### P1 — System Improvements
8. **Instrument remaining Claude calls** — `morningBriefing.ts`, `fitness.ts`, `voice/intent` routes need `trackServiceUsage('claude', ...)` for accurate cost tracking.
9. **Garmin sync tracking** — add `trackServiceUsage('garmin', ...)` to garmin sync for utilities page accuracy.

### P2 — Polish
10. **ElevenLabs voice tuning** — Morgan stability 0.75, similarity_boost 0.8.
11. **Mobile verification** — test `/health` and `/utilities` page layouts on mobile.
12. **Health page OKR progress in briefing** — add OKR summary to Sunday briefing context.

## User Context
- Filman is on Week 9 of transformation program starting March 23, 2026.
- Currently Phase 1. Next blood work due ~April 2026 (Prodia HL II light panel).
- Apple Health shortcuts are configured and active.
- Weight tracking via Apple Health webhook has been working since Sprint 5.

## Gotchas
1. **Garmin rate limiting** — Cloudflare blocks Railway's IP after too many login attempts. Session caching mitigates this, but avoid calling backfill + cron simultaneously.
2. **`sync_status.last_error`** stores Garmin tokens as JSON — don't clear this field thinking it's an error message.
3. **OKR progress %** requires `baseline_value` in `okr_targets` — some KRs (waist, dead hang, etc.) have NULL baselines and won't show progress until first measurement is recorded.
4. **Delta briefing** requires a morning briefing to have been generated first (needs `baseline_snapshot` in `briefing_cache`).

# Sprint 9 Handover

## Sprint 8 Summary (v1.8.0)

Sprint 8 delivered Notion context integration, Garmin backfill rewrite, and dashboard UI improvements. 1 new table, 1 new API route, shared context builder across all Claude call sites.

### Current State
- **Version:** 1.8.0 deployed on Railway
- **All 3 Sprint 8 features merged and live**
- **Notion context:** 5 pages synced (About Me, Communication, Work, Growth, Projects), cron set up every 2 weeks
- **Garmin backfill:** triggered, results pending verification
- **Dashboard:** font sizes increased, qualifier badges added, nav link with home icon

### New Env Vars
None added in Sprint 8 (all features use existing env vars).

### Migration
`supabase/migration-011-notion-context.sql` — applied. Creates:
- `notion_context` — stores synced Notion page content for Claude context injection

### Cron Jobs (cron-job.org)
| Job | URL | Schedule | Header |
|-----|-----|----------|--------|
| Google Calendar | `/api/cron/google-calendar` | Every 1 hour | x-cron-secret |
| Outlook Calendar | `/api/cron/outlook-calendar` | Every 1 hour | x-cron-secret |
| Garmin | `/api/cron/garmin` | Every 3 hours | x-cron-secret |
| Notion Tasks | `/api/cron/notion-tasks` | Every 3 hours | x-cron-secret |
| Email Synthesis | `/api/cron/email-synthesis` | Every 6 hours | x-cron-secret |
| Morning Briefing | `/api/cron/morning-briefing` | Daily 7:30 WIB | x-cron-secret |
| Fitness | `/api/cron/fitness` | Weekly Sunday 18:00 | x-cron-secret |
| **Notion Context (NEW)** | `/api/cron/notion-context` | Every 2 weeks | x-cron-secret |

## Sprint 9 Candidates

### P0 — Carry-Forward
1. **Verify Garmin backfill results** — check if Cloudflare blocked any requests during the backfill run. Inspect `garmin_daily` table for 56-day coverage.
2. **Verify qualifier badges** — confirm badges display correctly on HealthCard after Garmin sync populates raw_json fields.

### P1 — Health & Fitness Enhancements
3. **Trend sparkline charts** — 7-day mini charts for each OKR metric on `/health` page. Data API already exists (`GET /api/health-fitness/trends`).
4. **Training adherence auto-calculation** — count Garmin activities vs expected sessions from `fitness_context`.
5. **10k run time auto-detection** — parse `garmin_activities` for runs >=9.5km, extract elapsed time.
6. **Quarterly blood work reminder** — briefing alert when next Prodia panel is due per schedule.
7. **Enhanced AI health insights** — Claude analyzes 7-day data trends and surfaces observations on `/health` page.

### P2 — Polish
8. **Mobile layout verification** — test `/health` and `/utilities` on mobile after font size changes.

## Gotchas

1. **Notion context page IDs are hardcoded** in `src/lib/sync/notionContext.ts` — if pages are moved or deleted in Notion, update the IDs there.
2. **`buildJarvisContext()` has a 5-minute in-memory cache** — changes to the `notion_context` table take up to 5 minutes to reflect in Claude calls.
3. **Garmin backfill with `force=true`** will re-fetch ALL 56 days from API — use sparingly to avoid rate limits and Cloudflare blocks.
4. **Notion integration must have access** to all 5 context pages — pages must be shared via Connections in Notion for the API to read them.
5. **Garmin rate limiting** — Cloudflare blocks Railway's IP after too many login attempts. Session caching mitigates this, but avoid calling backfill + cron simultaneously.
6. **`sync_status.last_error`** stores Garmin tokens as JSON — don't clear this field thinking it's an error message.

## Voice Configuration
- **Voice:** Christopher (`G17SuINrv2H9FC6nvetn`) from ElevenLabs library
- **Model:** `eleven_multilingual_v2` (NOT turbo — turbo degrades voice quality)
- **Settings:** stability 0.75, similarity_boost 0.8, style 0
- **Env var:** `ELEVENLABS_VOICE_ID=G17SuINrv2H9FC6nvetn` on Railway

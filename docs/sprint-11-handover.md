# Sprint 11 Handover

## Sprint 10 Summary

Sprint 10 was a Garmin API reliability sprint. Fixed rate limiting, added circuit breaker, token seeding from residential IP, fitness age endpoint, timezone fix, Integration Health fixes, and OKR data wiring with 7-day averages.

### Current State
- **Garmin sync:** Working via cached OAuth tokens (seeded from residential IP)
- **Circuit breaker:** Active with exponential backoff (6h → 12h → 24h → 48h)
- **Daily budget:** 50 API calls/day
- **Backfill:** Disabled (building data forward from Mar 16)
- **Data:** Mar 16–21 complete, all 15 metrics + fitness age
- **OKR dashboard:** 7-day rolling averages for daily metrics, latest for VO2/fitness age

### Files Changed in Sprint 10
- `src/lib/sync/garmin.ts` — circuit breaker, sequential fetch, fitness age, timezone fix, budget
- `src/app/api/cron/garmin/route.ts` — graceful skip handling, error serialization
- `src/app/api/sync/garmin/route.ts` — block status endpoint
- `src/app/api/sync/garmin/backfill/route.ts` — graceful skip handling
- `src/app/api/cron/email-synthesis/route.ts` — added markSynced
- `src/app/api/cron/morning-briefing/route.ts` — added markSynced
- `src/app/api/utilities/integrations/route.ts` — filter internal types, align intervals
- `src/app/api/health-fitness/okr/route.ts` — 7-day averages, exclude today
- `scripts/seed-garmin-tokens.mjs` — new: login from residential IP, seed tokens
- `scripts/backfill-recent.mjs` — new: fetch specific days from local machine

### No New Env Vars, No Migrations

### Cron Jobs (unchanged schedule)
| Job | URL | Schedule | Header |
|-----|-----|----------|--------|
| Google Calendar | `/api/cron/google-calendar` | Every 3 hours 7am–7pm | x-cron-secret |
| Outlook Calendar | `/api/cron/outlook-calendar` | Every 3 hours 7am–7pm | x-cron-secret |
| Garmin | `/api/cron/garmin` | 7am, 1pm, 7pm | x-cron-secret |
| Notion Tasks | `/api/cron/notion-tasks` | Every 3 hours 7am–7pm | x-cron-secret |
| Email Synthesis | `/api/cron/email-synthesis` | 7am, 1pm, 7pm | x-cron-secret |
| Morning Briefing | `/api/cron/morning-briefing` | Daily 7:30 WIB | x-cron-secret |
| Fitness | `/api/cron/fitness` | Weekly Sunday 18:00 | x-cron-secret |
| Notion Context | `/api/cron/notion-context` | Every 2 weeks | x-cron-secret |

## Sprint 11 Candidates

### P0 — Carry-Forward
1. **Monitor Garmin sync stability** — verify cron runs succeed for 3+ consecutive days with no circuit breaker trips.
2. **OAuth token expiry** — tokens last ~1 year but monitor. If sync fails with auth error, re-run `scripts/seed-garmin-tokens.mjs` from residential IP.

### P1 — Health & Fitness Enhancements (deferred from Sprint 10)
3. **Trend sparkline charts** — 7-day mini charts for each OKR metric on `/health` page. Data API exists (`GET /api/health-fitness/trends`).
4. **Training adherence auto-calculation** — count Garmin activities vs expected sessions from `fitness_context`.
5. **10k run time auto-detection** — parse `garmin_activities` for runs >=9.5km, extract elapsed time.
6. **Enhanced AI health insights** — Claude analyzes 7-day data trends on `/health` page.

### P1 — Memory & Contextual Understanding
7. **Conversation memory** — store chat interactions, retrieve context in future sessions.
8. **Temporal awareness** — pass 7-day rolling summaries into Claude prompts for trend-aware responses.

### P1 — Speaking Mode (Full-Screen Reactor)
9. **Full-screen reactor during audio playback** — expand ArcReactor to full-screen during TTS, hide briefing text.

### P2 — Polish
10. **Arc Reactor simplified mode for sm size** — simpler ring-and-glow for TopBar icon.
11. **JarvisOrb cleanup** — remove old component (replaced by ArcReactor).
12. **Dashboard alerting for circuit breaker** — surface Garmin block status on dashboard.

## Gotchas

1. **Garmin tokens expire ~1 year** — when sync fails with auth error, run `node --env-file=.env.local scripts/seed-garmin-tokens.mjs` from your laptop (residential IP).
2. **Daily budget of 50 calls** — 3 cron runs = ~33 calls. Manual triggers consume from the same budget. If budget exceeded, sync skips until midnight WIB.
3. **Garmin `summary` endpoint returns 403** — steps come from `client.getSteps()` instead. Body battery comes from `stress` endpoint.
4. **OKR averages exclude today** — today's in-progress data is not included in 7-day rolling averages.
5. **Mar 16–20 missing fitness_age** — can be backfilled with one-liner script if needed (see Sprint 10 retrospective).
6. **Jan 31 – Mar 15 data gap** — 45 days missing, not backfillable without hitting rate limits. Accepted.

## Voice Configuration (unchanged)
- **Voice:** Christopher (`G17SuINrv2H9FC6nvetn`) from ElevenLabs library
- **Model:** `eleven_multilingual_v2` (NOT turbo — turbo degrades voice quality)
- **Settings:** stability 0.75, similarity_boost 0.8, style 0

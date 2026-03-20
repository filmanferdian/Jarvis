# Sprint 10 Handover

## Sprint 9 Summary (v2.0.0)

Sprint 9 was a pure visual redesign — UI v2.0. New design system, Canvas-based Arc Reactor, all components restyled to brand guidelines. No backend changes.

### Current State
- **Version:** 2.0.0 deployed on Railway
- **Design system:** new color tokens, typography, animations in `globals.css`
- **Arc Reactor:** Canvas 2D component with 4 states (idle/speaking/listening/thinking)
- **All pages:** using shared `AppShell` for layout consistency
- **Design reference pages:** `/brand`, `/mood`, `/style-tile` preserved as design documentation

### New Files
- `src/components/ArcReactor.tsx` — Canvas-based reactor (replaces JarvisOrb)
- `src/app/brand/page.tsx` — Brand guidelines visual deck
- `src/app/mood/page.tsx` — Mood board reference
- `src/app/style-tile/page.tsx` — Style tile / component catalogue
- `docs/design/05-brand-guidelines.md` — Brand guidelines document (v0.3)

### No New Env Vars, No Migrations
Sprint 9 was frontend-only.

### Cron Jobs (unchanged from Sprint 8)
| Job | URL | Schedule | Header |
|-----|-----|----------|--------|
| Google Calendar | `/api/cron/google-calendar` | Every 1 hour | x-cron-secret |
| Outlook Calendar | `/api/cron/outlook-calendar` | Every 1 hour | x-cron-secret |
| Garmin | `/api/cron/garmin` | Every 3 hours | x-cron-secret |
| Notion Tasks | `/api/cron/notion-tasks` | Every 3 hours | x-cron-secret |
| Email Synthesis | `/api/cron/email-synthesis` | Every 6 hours | x-cron-secret |
| Morning Briefing | `/api/cron/morning-briefing` | Daily 7:30 WIB | x-cron-secret |
| Fitness | `/api/cron/fitness` | Weekly Sunday 18:00 | x-cron-secret |
| Notion Context | `/api/cron/notion-context` | Every 2 weeks | x-cron-secret |

## Sprint 10 Candidates

### P0 — Carry-Forward from Sprint 9 Handover
1. **Verify Garmin backfill results** — check if Cloudflare blocked any requests. Inspect `garmin_daily` table for 56-day coverage.
2. **Verify qualifier badges** — confirm badges display correctly on HealthCard after Garmin sync populates raw_json fields.

### P1 — Health & Fitness Enhancements (deferred from Sprint 9)
3. **Trend sparkline charts** — 7-day mini charts for each OKR metric on `/health` page. Data API exists (`GET /api/health-fitness/trends`).
4. **Training adherence auto-calculation** — count Garmin activities vs expected sessions from `fitness_context`.
5. **10k run time auto-detection** — parse `garmin_activities` for runs >=9.5km, extract elapsed time.
6. **Quarterly blood work reminder** — briefing alert when next Prodia panel is due.
7. **Enhanced AI health insights** — Claude analyzes 7-day data trends on `/health` page.

### P1 — Speaking Mode (Full-Screen Reactor)
8. **Full-screen reactor during audio playback** — when TTS plays, expand ArcReactor to full-screen (`size="full"`), hide briefing text, pure cinematic moment. Brand guidelines specify this as the signature JARVIS moment.

### P2 — Polish
9. **Arc Reactor simplified mode for sm size** — current 32px rendering has too much detail; consider a simpler ring-and-glow for TopBar icon.
10. **JarvisOrb cleanup** — remove old `JarvisOrb.tsx` component and associated CSS animations (legacy code now replaced by ArcReactor).

## Gotchas

1. **Design reference pages** (`/brand`, `/mood`, `/style-tile`) use `style jsx global` which causes hydration warnings in dev mode — not a production issue, just a dev annoyance.
2. **ArcReactor uses `requestAnimationFrame`** — runs at 60fps, no throttling. On low-end devices, consider reducing frame rate or skipping frames.
3. **`prefers-reduced-motion`** is checked at render time, not reactively — if the user toggles the OS setting, they need to reload the page.
4. **Health/Utilities pages now use AppShell** — removed direct TopBar/Sidebar imports. All layout goes through `AppShell` for consistency.
5. **JarvisOrb is still in the codebase** but no longer imported by any page. Safe to delete in Sprint 10.

## Voice Configuration (unchanged)
- **Voice:** Christopher (`G17SuINrv2H9FC6nvetn`) from ElevenLabs library
- **Model:** `eleven_multilingual_v2` (NOT turbo — turbo degrades voice quality)
- **Settings:** stability 0.75, similarity_boost 0.8, style 0
- **Env var:** `ELEVENLABS_VOICE_ID=G17SuINrv2H9FC6nvetn` on Railway

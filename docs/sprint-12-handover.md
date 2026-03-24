# Sprint 12 Handover

## Sprint 11 Summary (v2.1.2)

Sprint 11 added current events synthesis from newsletter emails and unified all synthesis prompts to natural prose style. Also included Garmin API rate limiting and integration health fixes carried from Sprint 10.

### Current State
- **Version:** 2.1.4 deployed on Railway
- **Synthesis style:** all prompts use markdown — **bold** section labels, bullet points, numbered lists, rendered via shared `renderMarkdown` helper
- **News sources:** Bloomberg and NYT only (tier system removed), cross-referenced stories with multi-source attribution
- **TTS:** audio generation is non-blocking (fire-and-forget) to prevent cron timeouts
- **Current events:** newsletters automatically distilled into morning briefing
- **Garmin:** circuit breaker + daily budget to prevent rate limiting
- **Integration health:** all crons call markSynced, internal types filtered from dashboard

### Files Changed in Sprint 11
- `src/app/api/cron/email-synthesis/route.ts` — prose style prompt, current events synthesis
- `src/app/api/cron/morning-briefing/route.ts` — unified prompt style, TTS logic preserved
- `src/components/EmailCard.tsx` — removed left border and section header rendering
- `src/lib/garmin.ts` — circuit breaker, sequential fetch, daily budget
- `src/app/api/cron/garmin/route.ts` — rate limiting integration

### No New Env Vars

### No New Migrations

### Cron Jobs (updated intervals from Sprint 10)
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
| Contact Scan | `/api/cron/contact-scan` | Weekly Sunday | x-cron-secret |

## Sprint 12 Delivery (v2.2.9)

### Contact Scanner
- Scans Google Calendar + Outlook for external attendees
- Filters internal domains (`@infinid.id`, `@pijar.com`, `@infinidgroup.co.id`) and meeting room resources
- Matches against 233 existing Notion Contacts → updates "Last contact" date
- New contacts staged in Supabase `scanned_contacts` table for triage
- Dedicated `/contacts` page with summary cards, inline editing, batch sync to Notion
- New env var: `NOTION_CONTACTS_DB_ID=ea7c674aecec8305800e019759d5929d`
- New migration: `migration-016-scanned-contacts.sql` (applied)

### User Actions Required
1. **Set up cron-job.org** — Add `GET /api/cron/contact-scan` weekly (Sundays, e.g., 18:00 WIB) with `x-cron-secret` header
2. **Triage initial contacts** — Visit `/contacts`, review the 14 pending contacts, edit names/companies, sync to Notion
3. **Add `NOTION_CONTACTS_DB_ID`** on Railway env vars (value: `ea7c674aecec8305800e019759d5929d`)

### Other Sprint 12 Fixes (v2.2.1–v2.2.8)
- KPI cards curated (6 fixed cards), 7-day step average, tasks 3-day visibility
- Fitness program Notion database (365 days), deload every 4 weeks
- Email/news synthesis time_slot support, 2-period visibility
- OKR fixes, dashboard cleanup, bullet point rendering

## Sprint 12 Candidates

### P0 — Carry-Forward
1. **Sprint 10 retrospective** — never written; document Garmin rate limiting and integration health work
2. **Verify current events synthesis quality** — check that newsletter distillation produces useful briefing content over a few days of real data
3. **PR workflow** — set up `gh` CLI or alternative so PRs can be created from dev environment

### P1 — Health & Fitness (deferred since Sprint 10)
4. **Trend sparkline charts** — 7-day mini charts for each OKR metric on `/health` page. Data API exists (`GET /api/health-fitness/trends`)
5. **Training adherence auto-calculation** — count Garmin activities vs expected sessions from `fitness_context`
6. **10k run time auto-detection** — parse `garmin_activities` for runs >=9.5km, extract elapsed time
7. **Enhanced AI health insights** — Claude analyzes 7-day data trends on `/health` page

### P1 — Speaking Mode
8. **Full-screen reactor during audio playback** — expand ArcReactor to full-screen during TTS, hide briefing text for cinematic JARVIS moment

### P2 — Polish
9. **Arc Reactor simplified mode for sm size** — 32px rendering has too much detail; simpler ring-and-glow for TopBar
10. **JarvisOrb cleanup** — remove legacy `JarvisOrb.tsx` (no longer imported anywhere)

## Sprint 12 Deliveries (Late Additions)

### OKR Page Redesign
- **Files changed:**
  - `src/app/health/page.tsx` — layout reorder (Health Insights below O4)
  - `src/components/health/OkrCard.tsx` — redesigned with status badges, units, baseline annotations, consistent formatting
  - `src/app/api/health-fitness/okr/route.ts` — dynamic baseline computation from earliest Garmin/weight data
- **No new env vars or migrations** — baselines computed dynamically from existing data; user can manually set `baseline_value` in `okr_targets` table to override
- **Branch:** `claude/redesign-okr-page-DwHZA`

## Gotchas

1. **Synthesis prompts use markdown** — all three prompts (briefing, email, news) produce markdown. The `renderMarkdown` helper in `src/lib/renderMarkdown.ts` converts to HTML for display. TTS reads from the raw text which may include `**` markers
2. **Garmin circuit breaker state is in-memory** — resets on Railway redeploy. This is fine since it's a safety mechanism, not persistent state
3. **Current events synthesis depends on newsletter emails existing** — if no newsletters arrive, the current events section will be empty in the briefing
4. **`prefers-reduced-motion`** is checked at render time, not reactively — user must reload after toggling OS setting

## Voice Configuration (unchanged)
- **Voice:** Christopher (`G17SuINrv2H9FC6nvetn`) from ElevenLabs library
- **Model:** `eleven_multilingual_v2` (NOT turbo — turbo degrades voice quality)
- **Settings:** stability 0.75, similarity_boost 0.8, style 0
- **Env var:** `ELEVENLABS_VOICE_ID=G17SuINrv2H9FC6nvetn` on Railway

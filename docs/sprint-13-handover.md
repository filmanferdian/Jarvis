# Sprint 13 Handover

## Sprint 12 Summary (v2.2.12)

Sprint 12 delivered dashboard polish, fitness program Notion database, contact scanner, OKR page redesign, email style analysis, ghostwriting style guide, and email triage with auto-draft replies.

### Current State
- **Version:** 2.2.12 deployed on Railway
- **OKR page:** Redesigned with status badges, units, baseline annotations, consistent formatting
- **OKR baselines:** 17 of 23 KRs populated (Garmin from Jan 19-25 avg, manual entries for body metrics)
- **Contact scanner:** `/contacts` page with triage, weekly cron scan
- **Fitness program:** Notion database (365 days), deterministic scheduling
- **Ghostwriting style guide:** Notion page synced as `ghostwriting` context key, available to all Jarvis Claude calls
- **Email triage:** Runs during email synthesis cron (7am, 1pm, 7pm). Classifies work emails, auto-drafts replies for need_response. Outlook drafts working, Gmail drafts working after scope upgrade.
- **Email triage UI:** `/emails` page with summary, expandable rows, draft previews. KPI card on dashboard showing triaged/total count.
- **OAuth scopes:** Microsoft has Mail.ReadWrite, Google has gmail.compose (requires re-auth after deploy)

### Files Changed in Sprint 12

**OKR Redesign:**
- `src/app/health/page.tsx` — layout reorder, context interface
- `src/components/health/OkrCard.tsx` — full redesign with formatting, units, baselines, context
- `src/app/api/health-fitness/okr/route.ts` — dynamic baselines, HRV week-over-week, range progress fix
- `src/lib/sync/garmin.ts` — `backfillDateRange()` with `computeBaseline` option
- `src/app/api/sync/garmin/backfill/route.ts` — date range + computeBaseline params

**Contact Scanner:**
- `src/lib/contacts.ts`, `src/lib/sync/contactScan.ts`
- `src/app/api/contacts/` — 4 routes
- `src/app/api/cron/contact-scan/route.ts`
- `src/app/contacts/page.tsx`
- `supabase/migration-016-scanned-contacts.sql`

**Email Triage + Ghostwriting:**
- `src/lib/sync/emailTriage.ts` — core triage orchestrator (classify + draft + create)
- `src/lib/microsoft.ts` — added `fetchRecentEmailsFull()`, `createOutlookDraft()`, Mail.ReadWrite scope
- `src/lib/google.ts` — added `fetchRecentEmailsFull()`, `createGmailDraft()`, gmail.compose scope
- `src/lib/sync/notionContext.ts` — added `ghostwriting` page key
- `src/lib/context.ts` — added `ghostwriting` to ALL_PAGES and SECTION_HEADERS
- `src/app/api/emails/triage/route.ts` — GET today's triage data
- `src/app/api/emails/style-analysis/route.ts` — email style analysis endpoint
- `src/app/api/cron/email-synthesis/route.ts` — integrated triage call
- `src/app/emails/page.tsx` — email triage UI page
- `src/app/utilities/page.tsx` — email style analysis UI section
- `src/components/EmailCard.tsx` — triage summary strip on dashboard
- `src/components/KpiRow.tsx` — email triage KPI card (first in row)
- `src/components/Sidebar.tsx` — Email Triage nav item
- `supabase/migration-017-email-triage.sql` — email_triage table
- `CLAUDE.md` — ghostwriting style guide section
- Notion page: `32dc674aecec817198f2ead59e09873c` (Ghostwriting style guide)

**Dashboard & Data:**
- `src/components/KpiRow.tsx` — fixed display order, 7-day step avg, email triage card
- `src/components/TasksCard.tsx` — 3-day visibility
- `src/lib/sync/fitness.ts` — Notion database integration, deload fix
- Various synthesis and rendering fixes

### New Env Vars
- `NOTION_CONTACTS_DB_ID=ea7c674aecec8305800e019759d5929d`

### Migrations Applied
- `migration-016-scanned-contacts.sql` — `scanned_contacts` table
- `migration-017-email-triage.sql` — `email_triage` table

### DB Changes (no migration needed)
- `okr_targets.baseline_value` populated for 17 KRs
- `okr_targets.target_direction` changed to `range` for `daily_steps`
- `okr_targets.baseline_value` set to `0` for `hrv_decline_pct`
- `okr_targets.is_active` set to `false` for `body_battery_wake`

### Cron Jobs
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

### Garmin Backfill API
New date range mode: `POST /api/sync/garmin/backfill?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&computeBaseline=true`
- Bypasses 56-day retention limit
- `computeBaseline=true` averages fetched data, writes to `okr_targets`, then cleans up rows

## Sprint 13 Candidates (from Sprint 12)

### P0 — Carry-Forward
1. **Sprint 10 retrospective** — never written; document Garmin rate limiting and integration health work
2. **Verify current events synthesis quality** — check newsletter distillation over real data
3. **OKR baselines remaining** — 6 KRs still missing baselines (all blood work / manual: 10k run, BP, HbA1c, glucose, triglycerides/HDL, testosterone). Will populate after first blood work (scheduled Apr 1, 2026).

### P1 — Health & Fitness
4. **Trend sparkline charts** — 7-day mini charts for each OKR metric on `/health` page
5. **10k run time auto-detection** — parse `garmin_activities` for runs >=9.5km, extract elapsed time
6. **Blood work entry UI** — streamline manual entry for quarterly lab results

### P1 — Speaking Mode
7. **Full-screen reactor during audio playback** — expand ArcReactor to full-screen during TTS

### P2 — Polish
8. **Arc Reactor simplified mode for sm size** — simpler ring-and-glow for TopBar
9. **JarvisOrb cleanup** — remove legacy `JarvisOrb.tsx`

## Gotchas

1. **Synthesis prompts use markdown** — `renderMarkdown` helper converts to HTML. TTS reads raw text with `**` markers.
2. **Garmin circuit breaker state is in-memory** — resets on Railway redeploy.
3. **Current events synthesis depends on newsletter emails** — empty if no newsletters arrive.
4. **Garmin data pruning** — `pruneOldRecords()` deletes data older than 56 days on each daily sync. Date range backfill with `computeBaseline=true` cleans up after itself to avoid data loss.
5. **HRV decline needs both weeks** — returns null if either previous or current week has no Garmin data. Early in the week (Mon/Tue), current week has very few data points.
6. **Steps uses `range` direction** — target_min=9000, target_max=12000. Current >= 9000 = 100%. Different from other `higher_is_better` metrics.
7. **Stable Garmin metrics (VO2 Max, Fitness Age)** — today's row may have null if synced early. API scans backwards through recent rows to find first non-null value.
8. **Progress calc edge case** — if baseline is already better than target (e.g., stress baseline 37 < target 40), current <= target = 100%. Without this, the formula produces negative/zero progress.
9. **OKR scoring is weighted** — each objective = 20 points, KRs equally weighted within, each capped at 100%. Total score = sum of objective contributions (0-100). No overscoring from strong metrics.
10. **Lean mass is a floor metric** — uses `range` direction with target_min=74. Current >= 74 = 100%. Different from other `higher_is_better` metrics.
11. **Training adherence deactivated** — removed from O3. O3 now has 3 KRs: Dead Hang, Steps, OHS.
12. **Email triage deduplication** — uses `UNIQUE(message_id, source)` constraint. Re-runs within the same day skip already-triaged emails. New day = fresh triage.
13. **Ghostwriting context page** — in `ALL_PAGES` but NOT `DEFAULT_PAGES`. Included in briefings/voice/delta (via `allPages()`) but not basic API calls, to keep token usage efficient.
14. **Outlook draft threading** — uses `POST /me/messages/{id}/createReply` then `PATCH` to set body. This properly threads the reply in the conversation. Standalone `POST /me/messages` does not thread.
15. **Gmail draft requires gmail.compose scope** — the scope was added to `google.ts` SCOPES constant. After deploy, `filman@group.infinid.id` must re-authenticate at `/api/auth/google`. Other Google accounts keep working with readonly tokens.
16. **Email triage cost** — typically 2 Claude calls per cron run (~$0.06). 3 runs/day = ~$0.18/day. Well within 50 daily call limit.
17. **Work accounts are hardcoded** — `WORK_GMAIL` and `WORK_OUTLOOK` in `emailTriage.ts`. Only these two accounts are triaged, not personal Gmail accounts.

## Voice Configuration (unchanged)
- **Voice:** Christopher (`G17SuINrv2H9FC6nvetn`) from ElevenLabs library
- **Model:** `eleven_multilingual_v2` (NOT turbo — turbo degrades voice quality)
- **Settings:** stability 0.75, similarity_boost 0.8, style 0
- **Env var:** `ELEVENLABS_VOICE_ID=G17SuINrv2H9FC6nvetn` on Railway

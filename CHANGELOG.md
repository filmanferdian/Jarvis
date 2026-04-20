# Changelog

All notable changes to Jarvis are documented here.

Format: `{major}.{sprint}.{iteration}` — major version, sprint number, iteration within sprint.

## [3.0.1] — 2026-04-20

### Changed
- `/emails`, `/contacts`, `/utilities` rewritten to the v3.0 "Atmosphere" visual (Stream 3 of the migration). No API, Supabase, auth, or cron changes.
- Email Triage now uses a 400px list + detail split-pane per app.html `.email-grid`. Tabs for Needs response / Other / Blocked; blocklist management lives in its own tab instead of a collapsible section.
- New `src/components/EmailThread.tsx`: sender-grouped thread card with inline draft bubble, tone picker (Direct / Warm / Brief), and Send as-is / Edit draft actions that deep-link to the Gmail/Outlook drafts folder. Tone switching is cosmetic for now — flagged in backlog pending a regeneration endpoint.
- `EmailCard` (dashboard) is now a compact "Needs response" preview grouped by sender, linking to `/emails`. Drops the synthesis-prose accordion.
- `/contacts` is now a 2-col card grid with gradient avatars, a 12-week touch-history bar chart, and an italic ambient Jarvis suggestion line ("Last seen N days ago. Light follow-up may be timely."). Filter chips (All / Pending / In Notion / Ignored) replace the table-heavy layout.
- `/utilities` rewritten to 2-col connector cards + a recent cron-run log table (sourced from the existing `/api/cron/status` endpoint). Status lights use semantic tokens (good / warn / danger) — no neon in this scope.
- Neon-green audit within `emails/*`, `contacts/*`, `utilities/*`: 0 hits.

## [2.4.48] — 2026-04-20

### Added
- `/emails` breadcrumb now shows "Updated HH:MM WIB" from the most recent `email_triage.created_at`, giving a visible freshness signal (previously only a coarse Morning/Afternoon/Evening slot was derived internally, never rendered).
- `/contacts` header now shows "Last refreshed YYYY-MM-DD HH:MM WIB" from `max(scanned_contacts.updated_at)`. Scans can be days apart, so the date matters — the page previously had no way to tell whether the list reflected a fresh scan.
- API: `/api/emails/triage` and `/api/contacts` each return a new `lastRefreshedAt` ISO field (nullable). No schema changes.

## [2.4.47] — 2026-04-20

### Added
- HR Zone 2 calculator now tracks Garmin's actual LTHR. Daily Garmin sync calls `getUserSettings()` and stores `userData.lactateThresholdHeartRate` in a new `garmin_daily.lthr` column (migration-023). `/api/cardio/hr-zones` returns the latest non-null value (falls back to 164 only if empty). Resting HR is already the 4-week rolling average from `garmin_daily.resting_hr` — no change. Verified: today's row populated with LTHR 166.

## [2.4.46] — 2026-04-19

### Fixed
- OKR card now surfaces legacy `health_measurements` rows saved under older `measurement_type` names (`dead_hang`, `ohs_major_compensations`, `waist_circumference`, `blood_pressure_systolic`, `blood_pressure_diastolic`). The v2.4.45 fix made the read use the canonical OKR `key_result` directly, which orphaned historical data (e.g. the OHS "2 counts" reading). `/api/health-fitness/okr` now canonicalizes `measurement_type` into the OKR `key_result` when building the latest/previous maps, so old and new rows collapse into the same bucket.

## [2.4.45] — 2026-04-19

### Fixed
- `/api/health-fitness/okr` now reads manually-entered `dead_hang_seconds` and `overhead_squat_compensations` rows correctly. The `typeMap` remapped those OKR keys to `'dead_hang'` / `'ohs_major_compensations'`, but `/api/health/measurements` only accepts (and stores) the long names — so values saved from the `/health` manual entry form never surfaced on the OKR card. Dropped the two bogus mappings; kept the legitimate `waist_cm` / `bp_*` → long-name translations.

## [2.4.44] — 2026-04-19

### Fixed
- Manual Entry form on `/health` page no longer returns 405. `ManualEntryForm.handleMeasurement` was pre-flighting the POST endpoint with an unnecessary GET to `/api/health/measurements`; the route only exports POST, so Next.js returned 405 and `fetchAuth` threw before the actual save ever ran. Removed the stray GET (and the now-unused `fetchAuth` import).

## [2.4.43] — 2026-04-18

### Changed
- Weekly cardio synthesis is now plan-aware and continuity-aware. `generateWeeklyAnalysis()` takes two new inputs: last week's `WeeklyInsight` (for continuity with the prior `Focus Next Week`) and a `PlanContext` (this-week + next-week rows from Supabase `program_schedule`, plus the `# 5. Cardio protocol` slice from the Transformation program Notion page for Z2/tempo/VO2 HR semantics).
- The prompt now judges each run on three lenses — plan adherence (session type + duration vs the planned entry for that date), continuity (executing last week's focus), and progression-in-context (form/efficiency trends + like-for-like pace by session type). Raw weekly average pace is no longer compared across mixed session types, so intentional Z2 slowdowns are no longer flagged as regression.
- Added `src/lib/running-analysis/plan-loader.ts` with `loadWeekSchedule()`, `loadCardioProtocol()`, and `loadPreviousWeekInsight()`. The Notion cardio-protocol fetch is memoized per day.

## [2.4.42] — 2026-04-18

### Fixed
- Email Synthesis and Running Analysis no longer report as "Failed (timeout 30s)" on cron-job.org. Both routes now return 202 immediately and run the heavy work via Next.js `after()`, so the cron-job.org dashboard reflects actual outcome via `cron_run_log` instead of HTTP timeouts.

### Changed
- Added `runCronJob()` helper in `src/lib/cronLog.ts` that unifies `markSynced()` + `logCronRun()` in a single wrapper.
- Refactored cron routes to use the helper: `contact-scan`, `fitness`, `morning-briefing`, `news-synthesis`, `notion-context`, `email-synthesis`, `running-analysis`.
- Added `logCronRun()` coverage to `garmin` (all three branches) and `notion-context` (previously had no sync tracking at all). All 11 cron-job.org jobs now write an audit row to `cron_run_log`.

## [2.4.39] — 2026-04-18 (Sprint 14)

### Added
- Email draft blocklist (DB-backed): classified need_response emails whose senders match a blocklist pattern are still shown in the "Needs Response" section but skip draft generation. Prevents wasted Claude tokens on action-button emails (Kantorku HRIS approvals, reimbursement notifications).
- `/emails` page: collapsible "Draft Blocklist" section with add/remove and amber "skipped — pattern" indicator on blocked rows.
- `/api/emails/blocklist`: GET/POST/DELETE CRUD.
- `scripts/seed-kantorku-blocklist.mjs`: audits last 7 days for Kantorku senders and seeds the initial pattern.
- Migration 021: `email_draft_blocklist` table + `draft_skipped_reason` column on `email_triage`.

## [2.4.7] — 2026-03-29 (Sprint 14)

### Changed
- Fitness sync rewritten: reads from Supabase `program_schedule` table instead of Notion API — faster, simpler, no external API dependency

### Fixed
- Fitness program schedule: corrected 345 Notion database entries (day numbering off by +7 after Day 49, all Wed/Sat cardio stored as "walk" instead of "run")

### Added
- `program_schedule` table in Supabase (364 rows) as single source of truth for daily fitness program data
- `scripts/fix-fitness-schedule.mjs` — one-time Notion database correction script

## [2.1.4] — 2026-03-21 (Sprint 12)

### Changed
- Synthesis writing style: all prompts (briefing, email, news) now use markdown with **bold** section labels, bullet points, and numbered lists
- News synthesis: stories cross-referenced across all emails with multi-source attribution (e.g. Bloomberg, NYT)
- News synthesis: narrowed sources to Bloomberg and NYT only, removed tier system
- News synthesis: removed voiceover section

### Added
- Shared `renderMarkdown` helper (`src/lib/renderMarkdown.ts`) for consistent markdown-to-HTML across all synthesis cards

### Fixed
- Markdown not rendering in EmailCard (was plain text), BriefingCard and NewsCard (partial regex only)
- Morning briefing cron timeout: TTS audio generation now runs in background (fire-and-forget) so response returns within 30s

## [1.7.0] — 2026-03-19 (Sprint 7)

### Added
- Health & Fitness OKR dashboard (`/health`) tracking 5 objectives from Notion
- Apple Health webhook expansion for body fat, waist, BP, lean body mass
- Blood work tracking with reference range indicators
- Utilities page (`/utilities`) with integration health and API cost tracking
- Per-service API usage tracking (Claude tokens, ElevenLabs chars, etc.)
- ElevenLabs → OpenAI TTS auto-failover on credit exhaustion
- 56-day data retention for Garmin daily, activities, weight, and health measurements
- Delta briefing (mid-day change summary)
- Fitness sync cron job
- Live WIB date/time display in TopBar
- Versioning system with prominent pill badge display
- Navigation between Dashboard, Health, and Utilities pages

### Fixed
- Fitness extraction accuracy (week 13 vs week 8 bug)
- Garmin cron 500 error

### Changed
- Voiceover persona refined to Alfred/British butler style
- Version format: `{major}.{sprint}.{iteration}`

## [1.6.0] — 2026-03-18 (Sprint 6)

### Added
- ElevenLabs TTS integration with dual voice toggle (Paul/Morgan)
- Streaming audio playback for reduced latency
- Dual-script generation (written briefing + voiceover script)
- 6 transformation intelligence features (change detection, phase-aware briefing, workout adherence, milestone tracker, recovery alerts, biweekly check-ins)
- Task blacklist filter and Notion stale task cleanup

### Fixed
- Voice cutoff after first sentence (collect all chunks before playing)
- Markdown rendering in briefing/email cards

## [1.5.0] — Sprint 5

### Added
- Garmin Connect integration (daily health metrics + activities)
- Weight tracking via Apple Health webhook
- Fitness context sync from Notion transformation program
- Health and Fitness domain KPIs auto-populated from Garmin

## [1.4.0] — Sprint 4

### Added
- Microsoft Outlook calendar and mail integration
- Email synthesis with Claude summarization
- Voice input with intent parsing

## [1.3.0] — Sprint 3

### Added
- Google Calendar and Gmail integration
- Morning briefing generation with Claude
- Notion tasks sync

## [1.2.0] — Sprint 2

### Added
- Dashboard UI with domain health indicators
- Sidebar with life domains and health ring
- KPI tracking system

## [1.1.0] — Sprint 1

### Added
- Initial project setup (Next.js + Supabase)
- Authentication system (cookie + cron secret)
- Core database schema

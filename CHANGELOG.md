# Changelog

All notable changes to Jarvis are documented here.

Format: `{major}.{minor}` — from v3.0 onward we version by minor only (3.0, 3.1, 3.2…), not by patch.

## [3.0] — 2026-04-20 — "Atmosphere"

Complete UI migration from v2 (dark, arc-reactor) to v3.0 "Atmosphere" — light-primary cinematic, periwinkle ambient, neon green reserved only for liveness. Shipped via three parallel streams behind a shared foundation commit. No API, Supabase, auth, or cron changes across the whole migration.

### Foundation & shell (Stream 1)
- `src/app/globals.css`: new Atmosphere token set — surfaces (`#f7f8fc` canvas, `#ffffff` card, `#fafbff` elevated, `#ecedf5` deep), borders, ink hierarchy (`--color-jarvis-text-primary/-dim/-faint`), hybrid accents (`--color-jarvis-cta` blue / `-ambient` periwinkle / `-aurora` magenta / `-live` neon). Legacy v2 tokens kept as aliases during migration; will retire in a follow-up cleanup.
- `src/app/layout.tsx`: register Space Grotesk + Inter + JetBrains Mono via `next/font/google` as CSS variables. Drop permanent `dark` class.
- `src/components/Mindmap.tsx` (new): canvas brand glyph — Fibonacci-sphere node layout, depth-sorted edges, pulse firing proportional to state. Props `size`, `state` (`idle | thinking | speaking | listening`), `density`. Honors `prefers-reduced-motion` by freezing at idle snapshot.
- `src/components/Sidebar.tsx`: rewrite as collapsible 72px → 240px on hover/pin (localStorage `jarvis.sidebar.pinned`). Static brand-mark SVG (7-neuron snapshot + radial gradient) + JARVIS wordmark. Seven routes: dashboard, briefing, health, cardio, email, contacts, utilities.
- `src/components/TopBar.tsx`: rewrite — 36px animated Mindmap glyph + WIB greeting + ⌘K trigger + tokenized Online pill (the one sanctioned `--color-jarvis-live` use) + ambient-soft mic button.
- `src/components/CommandPalette.tsx` (new): global `⌘K` / `Ctrl+K` shortcut, backdrop-blur overlay, grouped results (Actions / Jump to / Suggestions), integrated Web Speech API voice input, `↑↓ / ↵ / Esc` keyboard nav. Replaces the floating `VoiceMic` mount for desktop flows.
- Split `BriefingCard.tsx` into `BriefingHero.tsx` (dashboard hero with 180px Mindmap + CTA + ghost "Read transcript" + duration meta) and `BriefingOverlay.tsx` (full-viewport cinematic portal: 560px mindmap stage, transcript rail with past/current/upcoming fades, scrubber, chapter list; reuses `SpeakingContext` for TTS).
- `AppShell.tsx`: mounts Sidebar + TopBar + CommandPalette. Removed `SpeakingOverlay` mount.
- Deleted `src/components/SpeakingOverlay.tsx` (replaced by `BriefingOverlay`).
- Archived `/brand`, `/style-tile`, `/mood` + `ArcReactor.tsx` to `src/_archive/` (tsconfig-excluded).

### Health & Cardio (Stream 2)
- `/health`: readiness-narrative hero + 3-col health metric grid + OKR ridgeline + blood-work panel per spec §8.3.
- `/cardio-analysis`: zone distribution as stacked horizontal bar in ambient colors, HRV-vs-load scatter, Jarvis verdict card. Tokenized hardcoded Recharts hex values.
- `src/components/health/OkrCard.tsx`: rewritten as the **OKR Ridgeline** canvas (5 objectives × 14-day history, periwinkle gradient fills, JetBrains Mono axis labels) per spec §8.1. Ported `drawRidgeline` from the design-system prototype.
- `src/components/health/HealthInsights.tsx`: added narrative-annotation slot per §8.3. Accepts narrative as a prop; generator endpoint `POST /api/health/narrate` is backlogged.

### Email / Contacts / Utilities (Stream 3)
- `/emails`: 400px list + detail split-pane per app.html `.email-grid`. Tabs for Needs response / Other / Blocked; blocklist moved out of collapsible into its own tab.
- `src/components/EmailThread.tsx` (new): sender-grouped thread card with inline draft bubble, tone picker (Direct / Warm / Brief), and Send as-is / Edit draft actions that deep-link to the Gmail/Outlook drafts folder. Tone switching is cosmetic pending a regeneration endpoint (backlogged).
- `EmailCard` (dashboard): compact "Needs response" preview grouped by sender, linking to `/emails`. Drops the synthesis-prose accordion.
- `/contacts`: 2-col card grid with gradient avatars, 12-week touch-history bar chart, italic ambient Jarvis suggestion ("Last seen N days ago. Light follow-up may be timely."). Filter chips (All / Pending / In Notion / Ignored) replace the table-heavy layout.
- `/utilities`: 2-col connector cards + recent cron-run log table (sourced from existing `/api/cron/status`). Status lights use semantic tokens (good / warn / danger) — no neon in this scope.

### Discipline
- Neon-green audit: 0 hits across all three streams' scope.
- All three streams merged with zero file-level conflicts (disjoint scope design).
- `npm run build` clean after each merge.

### Follow-ups (same-version bugfixes, no bump)
- `BriefingOverlay.tsx`: playback rewritten to mirror `TTSButton.tsx`'s robust pattern — fetch-as-blob for the stored Supabase Storage URL instead of binding it directly as `audio.src`, `playsinline` + `preload='auto'` + wait for `canplaythrough` (5s fallback), AbortController, 20s timeout, and Web Speech fallback if both stored-audio and `/api/tts` fail. Play button now shows a loading spinner while fetching/buffering. Fixes the "can't play the briefing" regression from the initial v3.0 ship.
- `TopBar.tsx`, `Sidebar.tsx`: version chip is now visible in the UI again. TopBar renders a `v{VERSION.display}` pill next to the greeting; Sidebar appends it inline after the `JARVIS` wordmark (visible when expanded/pinned).
- `BriefingHero.tsx`: preview subtitle no longer shows literal `**Calendar Overview**...`. New `getPreview()` helper skips leading heading-only paragraphs and strips inline `**bold**` markers so the subtitle reads as clean prose, not raw markdown.
- `src/app/page.tsx` dashboard: wrapped all children in a single `space-y-5` stack so `BriefingHero` and `KpiRow` are no longer flush; replaces the earlier ad-hoc `mt-5` wrappers on the grid and email/news/fitness blocks.

### Briefing readability + preload (v3.0.2) — 2026-04-20
- `BriefingOverlay`: strip markdown (`**bold**`, `*italic*`, `# heading`, `- ` and `1. ` list markers) from both the voiceover and briefing source before `splitLines`. Drop heading-only short lines (2–4 words, no sentence punctuation) so section labels like "Calendar Overview" don't appear as their own subtitle beat.
- Drop the full `01…NN` transcript rail. Keep a single centered subtitle — current line in 26–32px display type, with a faint next-line preview underneath.
- Preload audio the moment the overlay opens. New effect chains fetch → attach `<audio>` → wait for `canplay` (5s cap) → `status='ready'`. Play button is now instant; `onplay` / `onpause` drive status, so tapping pause/resume doesn't re-fetch.
- Scrubber is now a seekable `<input type="range">` bound to `audio.currentTime`. Fully seekable once the blob is in memory.
- Mindmap stage trimmed 560 → 480px to give the new subtitle vertical air above it.

### Mobile polish (v3.0.1) — 2026-04-20
- `AppShell`: mobile-aware sidebar drawer state + reduced gutter padding (`px-4 sm:px-6 md:px-8`).
- `Sidebar`: below `md:` hides by default and slides in as a fixed 240px drawer with backdrop when `mobileOpen`. Labels force-visible during drawer mode; drawer auto-closes on route change.
- `TopBar`: hamburger visible below `md:`, greeting date/time hides below `sm:`, ⌘K search collapses to icon-only below `md:`.
- `/emails`: removed the hardcoded `400px 1fr` split. Mobile uses single-pane master-detail — list hides when a row is selected; detail shows a "Back to list" button. Dropped the auto-pick-first-row effect so the list is what loads on mobile.
- `/utilities` cron log: stacks to a 2-line card layout below `md:` (Job + status, Last run · Duration). Desktop keeps the 4-column grid.
- `/utilities` API usage table: hides Tokens in / Tokens out / Chars columns below `sm:`; keeps Service / Calls / Cost.
- `BriefingOverlay`: padding reduced from `px-8 py-16` to `px-4 py-8 sm:px-8 sm:py-16`.
- `/health` readiness hero: `text-[56px] sm:text-[72px]`, `p-5 sm:p-7`, `gap-5 md:gap-8`.
- `/cardio-analysis` zone distribution: dropped fixed `60px 1fr 80px` inline columns; uses `grid-cols-[auto_1fr_auto]` so narrow labels don't crush the bar.
- `VERSION.display` now consumed by the UI chips (was still reading `VERSION.string` pre-merge).
- `package.json` bumped to `3.0.1` (full semver, per updated CLAUDE.md split — UI still displays `v3.0`).

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

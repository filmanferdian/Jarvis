# Backlog

Future features, pickup notes, and scope-later items. Mirrors the Notion Product backlog page. Grouped by priority tier; newest-first within each tier.

---

## High priority

_Empty — all items shipped._

---

## Medium priority

### 2026-04-28 — Email triage: Phase C cleanup (drop dormant draft schema)

**Context:** v3.13.0 disabled email drafting at the orchestrator level but left the helper functions, `email_draft_blocklist` table, and `email_triage.draft_*` columns intact for easy re-enable. If Filman doesn't reactivate drafting within ~3 months, the dormant pieces become pure noise.

**Scope:**
- Drop `email_draft_blocklist` table (new migration).
- Drop `draft_created`, `draft_id`, `draft_snippet`, `draft_skipped_reason` columns from `email_triage`.
- Delete `generateDraftReplies`, `createDrafts`, `loadBlocklist`, `matchBlocklist` from `src/lib/sync/emailTriage.ts`.
- Delete `/api/emails/blocklist/route.ts` and `/api/emails/style-analysis/route.ts`.
- Remove `ghostwriting` from `src/lib/sync/notionContext.ts` page map and from `src/lib/context.ts` exports.
- Archive the Notion `ghostwriting` page (32dc674aecec817198f2ead59e09873c) or repurpose it.
- Remove `draft_snippet` rendering from `EmailCard.tsx` (lines 108–112) and the "drafted" count from the summary line.
- Remove drafted-email KPI from `KpiRow.tsx` if present.

**Trigger:** Revisit ~2026-07-28 (3 months post-disable). If drafting is still off, ship Phase C.

### 2026-04-20 — Health metric narrative API (`POST /api/health/narrate`)

**Context:** Deferred from the Jarvis 3.0 "Atmosphere" migration (Wave 2 §9). The new `HealthInsights` component has a narrative-annotation slot per spec §8.3 — each metric gets a Claude-written sentence (e.g. "Yesterday's threshold intervals hit harder than the plan called for — your average HR in Z5 was 12bpm above target. I've moved tomorrow's threshold session to Wednesday."). Wave 2 ships with the slot accepting a `narrative` prop; this item wires up the server-side generator.

**Scope:**
- New route `src/app/api/health/narrate/route.ts` wrapped with `withCronAuth`.
- Pulls: readiness, HRV, sleep debt, training load, most recent workout summary from Supabase.
- Claude prompt synthesises 1–2 sentence narrative per metric in spec §10 voice (British butler, no emoji, no exclamation).
- Cache in Supabase `health_narratives` table (new migration) keyed by date + metric.
- Hooked into cron-job.org at 06:00 WIB daily, post-Garmin sync.
- `HealthInsights` fetches latest narrative row for today on render.

**Why defer:** Keeps the 3.0 migration UI-only. API + migration + cron job is a separate, verifiable ship.

**Effort estimate:** ~2 hours (route + migration + cron wiring + prompt tuning).

---

### 2026-04-22 — Current Events tabs: follow-ups (v3.2.0)

**Context:** v3.2.0 shipped Email / Indonesia / International tabs for Current Events. A few items were explicitly scoped out and should be picked up in follow-up ships once the core tab experience settles.

**Items:**
- **Voice read-out per tab.** Current voiceover field still points at the Email (legacy synthesis_text) only. The briefing-read-aloud flow should either read the currently-active tab or offer a per-tab listen button.
- **Per-theme outlet click-through.** NewsItem carries the Google News article URL but it is not persisted in news_synthesis nor surfaced in the UI. Consider storing the top N URLs per tab and rendering outlet chips as links.
- **Sanity-check International depth.** If Filman finds Google News International feels shallow versus what he consumes daily, swap Perplexity Sonar in for that tab only while keeping Google News RSS for Indonesia. Cost delta is under one dollar per month.
- **Cross-slot fatigue watch.** We deliberately did not dedupe across morning/afternoon/evening (developing stories should re-surface). Monitor whether this feels coherent or redundant in practice; revisit if fatigue.
- **Auto-login in dev.** Preview-server UI verification always has to pass the JARVIS_AUTH_TOKEN prompt. A NEXT_PUBLIC_DEV_AUTO_LOGIN flag that skips the gate when NODE_ENV=development would save a step every session.

---

### 2026-04-25 — Per-record sync logging: extend pattern to other sync paths

**Context:** v3.7.1 added `console.warn('[garmin] upsert failed for activity X: ...')` per failed record in `syncRecentActivities`. v3.8.1 propagated it to the 3 other Garmin sync sites (`syncGarmin`, `backfillGarmin`, `backfillDateRange`). The same silent-failure pattern likely lives in other sync paths — anywhere a `for ... of records` loop upserts and only counts successes.

**Idea:** sweep `src/lib/sync/*.ts` and `src/app/api/sync/**` for `if (!error) X++;` patterns where the `else` branch is silent. Add per-record warning logs. Candidates likely include `emails.ts`, `googleCalendar.ts`, `outlookCalendar.ts`, `notionTasks.ts`, `notionContext.ts`, `contactScan.ts`. Cost: maybe 30 lines of code, big payoff in observability. The v3.8.1 root-cause investigation took ~5 minutes once the warning was visible — would have taken hours to find without it.

**Out of scope until:** another sync silently misbehaves and surfaces as user pain, OR we want to be proactive about it.

---

## Low priority

### 2026-04-18 — Speed up slow cron endpoints (Email Synthesis, Running Analysis)

**Context:** Raised during v2.4.42 cron-log-coverage work. Email Synthesis and Running Analysis routinely take 30-60s server-side because they do sequential Claude + Gmail/Garmin/Notion calls. v2.4.42 masked this by returning 202 early and running work via `after()`, but the underlying latency is unchanged.

**Scope:**
- Split `running-analysis` into two cron pairs: (1) ingest-only (pull activities, enrich from Garmin, save to Supabase — fast) and (2) analyze (Claude multi-run insight — slow, runs once weekly after ingest settles).
- For `email-synthesis` + `email-triage`, consider batching Claude calls or moving per-email triage to a queue worker so cron just enqueues.
- Success criteria: both endpoints finish server-side in <10s.

**Why defer:** The `after()` pattern already fixes the monitoring problem; users see no wall-clock difference. Only worth doing if we add real SLOs or start paying cron-job.org Pro for longer HTTP timeouts.

**Effort estimate:** ~1 session for running-analysis split; email side is larger (queue infra).

---

### 2026-04-18 — Attachment-aware email triage

**Context:** Raised during v2.4.39 email-blocklist work. Jarvis currently does not open email attachments at all — only subject + body text + snippet are read. If an HR email says "see attached contract," Jarvis drafts based on the body alone.

**Scope:**
- Fetch attachments for emails classified as need_response
- MIME allowlist (PDF, images, plain text only — no .exe, .zip, .html, office macros)
- Size cap (e.g. 10 MB)
- Text-extraction only (pdf-parse or similar); never execute, never render HTML
- Extracted text goes through the existing prompt-injection defense (sanitizeMultiline + wrapUntrusted)
- No link following

**Out of scope:**
- Image OCR (future enhancement)
- Opening links in the email body

**Risk surface:** This is where malware/phishing becomes a real concern. Current defense is "don't touch attachments at all" — if we add this, we need a documented security review before shipping.

**Effort estimate:** ~1 full session. One new lib module (attachmentReader.ts), changes to fetchWorkEmails in emailTriage.ts, new env var for max attachment size.

---

### 2026-04-20 — Store provider-side draft URL on email_triage rows

**Context:** The v3.0 email thread's "Send as-is" and "Edit draft" buttons currently deep-link to the generic Gmail/Outlook drafts folder. The triage row doesn't carry the draft's provider URL, so we can't open the specific draft.

**Scope:**
- Migration: `supabase/migration-NNN-email-triage-draft-url.sql` adds a nullable `draft_url` column.
- `src/lib/sync/emailTriage.ts` captures `webLink` (Graph) / draft ID (Gmail) during creation.
- `/api/emails/triage` returns it; `EmailThread` uses it in place of the folder fallback.

**Effort estimate:** ~45 min (migration + sync capture + thread link update).

---

### 2026-04-20 — Tone regeneration endpoint for email drafts

**Context:** Stream 3 of the v3.0 Atmosphere migration shipped the tone-picker UI (Direct / Warm / Brief) in `EmailThread.tsx`, but the buttons only update local state — there is no server-side draft regeneration. Clicking a new tone does not produce a new draft.

**Scope:**
- New route `POST /api/emails/drafts/regenerate` accepting `{ triage_id, tone }`.
- Pulls the original email row + current draft from `email_triage`, re-prompts Claude with the ghostwriting style guide + the tone adjective, and overwrites `draft_snippet` in place (same provider-side Outlook/Gmail draft updated via Graph/Gmail API).
- Surface a loading state on the clicked tone chip and re-render the draft bubble on response.

**Why defer:** Kept Stream 3 as a pure UI/visual ship — no API surface change.

**Effort estimate:** ~1.5 hours (route + Claude prompt + provider draft update).

---

### 2026-04-25 — Lap segment classification: follow-ups (v3.7.2)

**Context:** v3.7.2 added a heuristic lap classifier that infers segment types (warm-up / main / tempo / interval-work / interval-rest / cool-down) from HR + pace + duration. Three follow-ups were explicitly scoped out of the "light touch" implementation.

**Items:**
- **Working-portion form averages.** Activity-level cadence, GCT, vertical oscillation, and vertical ratio still come from `raw_json` (Garmin's whole-activity summary), so VO2 max sessions where warm-up/cool-down are inside the same activity will see those metrics diluted. Re-compute from `splits` filtered to `main + tempo + interval-work` segments. Should also surface a "Working portion: cadence X, GCT Y" line on the Notion run page distinct from the activity-level number.
- **Per-segment decoupling for VO2 max.** `calcDecoupling` currently runs over the activity's full HR time-series with a fixed 3–5 min warmup exclusion. With segment labels available, a per-segment decoupling read would be more useful for interval workouts (e.g., decoupling within the tempo finish, decoupling across the 3 intervals as a set). Decide whether to surface as a new property or replace the activity-level number conditionally.
- **Surface segment labels to Claude weekly analysis.** The analysis-engine prompt only sees per-run summaries today; doesn't see per-lap segment classification. Could enable richer "you nailed the tempo finish on Saturday" / "the third VO2 interval was 5 bpm hot" feedback. Pass `splits` (with `segmentType`) into `extractRunSummaries` and add a "structured segments" block to the weekly synthesis prompt.

---

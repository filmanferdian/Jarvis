# Backlog

Future features, pickup notes, and scope-later items. Mirrors the Notion Product backlog page. Newest entries at top.

---

## 2026-04-23 — Cardio analysis: follow-ups (v3.4.0)

**Context:** v3.4.0 added Z5 calculator view, pace-based walk filter, and loosened weekly-review framing. A few items are out of scope for this ship.

**Items:**
- **Backfill: prune historical incline-walk entries.** The new `secPerKm <= 600` filter only applies to future ingestions. Any treadmill walks already logged to the Notion Runs DB from the v3.0.8 window remain. One-shot cleanup script that queries Notion Runs DB for pace > 10:00/km and archives them would clean the dataset the weekly analysis runs on.
- **Max-HR input for Z5 band accuracy.** Z5 bands lean heavily on the age-based `maxHR = 220 − age` fallback when a measured max HR is not yet synced. Once a true max from a race or Garmin test is known, the Z5 consensus band will tighten meaningfully. Worth prompting the user to enter a tested max HR once they have one.
- **Weekly-review observability.** The prompt change is invisible until the next Saturday cron fires. Add a "preview weekly analysis" button on `/cardio-analysis` that re-runs the analysis for the current partial week on demand, so prompt iterations can be tested without waiting for Saturday.

---

## 2026-04-22 — Current Events tabs: follow-ups (v3.2.0)

**Context:** v3.2.0 shipped Email / Indonesia / International tabs for Current Events. A few items were explicitly scoped out and should be picked up in follow-up ships once the core tab experience settles.

**Items:**
- **Voice read-out per tab.** Current voiceover field still points at the Email (legacy synthesis_text) only. The briefing-read-aloud flow should either read the currently-active tab or offer a per-tab listen button.
- **Per-theme outlet click-through.** NewsItem carries the Google News article URL but it is not persisted in news_synthesis nor surfaced in the UI. Consider storing the top N URLs per tab and rendering outlet chips as links.
- **Sanity-check International depth.** If Filman finds Google News International feels shallow versus what he consumes daily, swap Perplexity Sonar in for that tab only while keeping Google News RSS for Indonesia. Cost delta is under one dollar per month.
- **Cross-slot fatigue watch.** We deliberately did not dedupe across morning/afternoon/evening (developing stories should re-surface). Monitor whether this feels coherent or redundant in practice; revisit if fatigue.
- **Auto-login in dev.** Preview-server UI verification always has to pass the JARVIS_AUTH_TOKEN prompt. A NEXT_PUBLIC_DEV_AUTO_LOGIN flag that skips the gate when NODE_ENV=development would save a step every session.

---

## 2026-04-22 — RLS hardening sweep (drop permissive `FOR ALL USING (true)` policies)

**Context:** v3.1.0 fixed the CRITICAL advisor by enabling RLS on `email_draft_blocklist`. A Supabase advisor sweep afterward showed ~25 other tables still carry permissive `FOR ALL USING (true)` policies (WARN level). These tables include sensitive ones: `google_tokens`, `microsoft_tokens`, `garmin_tokens`, `weight_log`, `health_measurements`, `blood_work`, `okr_targets`, `api_usage`, `notion_tasks`, etc.

**Why it matters:** The app only writes via the service-role key, which bypasses RLS regardless. But a permissive `USING (true)` policy means ANY client with the anon/publishable key could also read/write — that's a real exposure on sensitive tables, not just a linter nit.

**Scope:**
- Drop the `FOR ALL USING (true)` policies on all ~25 flagged tables. Leave RLS enabled. No policy → only service-role can access (same pattern as `cron_run_log` and now `email_draft_blocklist`).
- Single migration, one `DROP POLICY` per table. No DDL beyond that.
- Verify with advisor re-run: WARN count should drop to zero.
- Add a pre-commit / CI hint: a tiny script that pings `get_advisors` and fails if any ERROR-level lint exists.

**Why defer:** User only asked to fix the CRITICAL issue. This is a broader hardening pass that deserves its own ship + retrospective entry, not a bundled afterthought.

**Effort estimate:** ~30 min for the migration + advisor re-check. Plus ~1 hour if the CI guard script is in scope.

---

## 2026-04-20 — Tone regeneration endpoint for email drafts

**Context:** Stream 3 of the v3.0 Atmosphere migration shipped the tone-picker UI (Direct / Warm / Brief) in `EmailThread.tsx`, but the buttons only update local state — there is no server-side draft regeneration. Clicking a new tone does not produce a new draft.

**Scope:**
- New route `POST /api/emails/drafts/regenerate` accepting `{ triage_id, tone }`.
- Pulls the original email row + current draft from `email_triage`, re-prompts Claude with the ghostwriting style guide + the tone adjective, and overwrites `draft_snippet` in place (same provider-side Outlook/Gmail draft updated via Graph/Gmail API).
- Surface a loading state on the clicked tone chip and re-render the draft bubble on response.

**Why defer:** Kept Stream 3 as a pure UI/visual ship — no API surface change.

**Effort estimate:** ~1.5 hours (route + Claude prompt + provider draft update).

---

## 2026-04-20 — Store provider-side draft URL on email_triage rows

**Context:** The v3.0 email thread's "Send as-is" and "Edit draft" buttons currently deep-link to the generic Gmail/Outlook drafts folder. The triage row doesn't carry the draft's provider URL, so we can't open the specific draft.

**Scope:**
- Migration: `supabase/migration-NNN-email-triage-draft-url.sql` adds a nullable `draft_url` column.
- `src/lib/sync/emailTriage.ts` captures `webLink` (Graph) / draft ID (Gmail) during creation.
- `/api/emails/triage` returns it; `EmailThread` uses it in place of the folder fallback.

**Effort estimate:** ~45 min (migration + sync capture + thread link update).

---

## 2026-04-20 — Health metric narrative API (`POST /api/health/narrate`)

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

## 2026-04-19 — Migrate legacy `health_measurements.measurement_type` rows to canonical names

**Context:** `health_measurements` has historical rows under old names (`dead_hang`, `ohs_major_compensations`) from before the POST endpoint's `VALID_TYPES` was renamed to `dead_hang_seconds` / `overhead_squat_compensations`. v2.4.46 works around this with a canonicalization layer in `/api/health-fitness/okr`, but the DB still carries drift.

**Scope:**
- One-off SQL migration (`supabase/migration-NNN-normalize-measurement-types.sql`) that rewrites `measurement_type` for all known legacy aliases.
- After the migration is applied in prod, remove `MEASUREMENT_TYPE_CANONICAL` from `src/app/api/health-fitness/okr/route.ts`.
- Also audit `waist_circumference` / `blood_pressure_systolic/diastolic` — currently those are the canonical DB names but the OKR `key_result` is short (`waist_cm`, `bp_systolic`, `bp_diastolic`). Either rename in DB to match OKR keys, or leave the canonicalization layer in place for those specifically.

**Why defer:** The canonicalization layer is cheap and ships work today. Only worth migrating the DB if another reader needs the same aliasing logic.

**Effort estimate:** ~30 min (migration + verify + remove shim).

---

## 2026-04-18 — Speed up slow cron endpoints (Email Synthesis, Running Analysis)

**Context:** Raised during v2.4.42 cron-log-coverage work. Email Synthesis and Running Analysis routinely take 30-60s server-side because they do sequential Claude + Gmail/Garmin/Notion calls. v2.4.42 masked this by returning 202 early and running work via `after()`, but the underlying latency is unchanged.

**Scope:**
- Split `running-analysis` into two cron pairs: (1) ingest-only (pull activities, enrich from Garmin, save to Supabase — fast) and (2) analyze (Claude multi-run insight — slow, runs once weekly after ingest settles).
- For `email-synthesis` + `email-triage`, consider batching Claude calls or moving per-email triage to a queue worker so cron just enqueues.
- Success criteria: both endpoints finish server-side in <10s.

**Why defer:** The `after()` pattern already fixes the monitoring problem; users see no wall-clock difference. Only worth doing if we add real SLOs or start paying cron-job.org Pro for longer HTTP timeouts.

**Effort estimate:** ~1 session for running-analysis split; email side is larger (queue infra).

---

## 2026-04-18 — Attachment-aware email triage

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

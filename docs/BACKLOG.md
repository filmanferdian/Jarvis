# Backlog

Future features, pickup notes, and scope-later items. Mirrors the Notion Product backlog page. Newest entries at top.

---

## 2026-04-20 — Sanitize briefing voiceover server-side

**Context:** v3.0.2 added client-side markdown stripping in `BriefingOverlay` (via a new `sanitizeForSpeech` helper) because the Claude-generated voiceover was leaking `**bold**` markers, `## headings`, and `1.` list labels into what the user saw on screen. The fix works, but the client should not have to do this — the voiceover is also fed to ElevenLabs TTS where these markers briefly get read aloud.

**Scope:**
- Update the briefing-regenerate prompt in `src/app/api/briefing/regenerate/route.ts` to produce voiceover as plain prose: no markdown, no numbered/bulleted lists, no short label-only paragraphs like "Calendar Overview".
- Keep the written `briefing` path as-is (markdown is valid there — `renderMarkdown.ts` handles it).
- Optionally move `sanitizeForSpeech` into `src/lib/briefingText.ts` and apply it server-side as a belt-and-suspenders before storing voiceover + generating audio.

**Why defer:** The client-side fix is sufficient for the user-visible bug. Server-side cleanup is a separate ship that also saves ElevenLabs characters.

**Effort estimate:** ~45 minutes (prompt tweak + one test regen + verify TTS audio).

---

## 2026-04-20 — Share briefing text utilities between Hero and Overlay

**Context:** `BriefingHero.tsx` has a `getPreview()` helper and `BriefingOverlay.tsx` has `sanitizeForSpeech()` + `splitLines()`. Both strip markdown; both skip heading-only paragraphs. Duplicated logic with slightly different rules — a legitimate short sentence could get dropped in one place and kept in another.

**Scope:**
- Extract to `src/lib/briefingText.ts` exporting `sanitizeBriefing(text)`, `previewLine(text)`, `splitLines(text)`.
- Update `BriefingHero.tsx` + `BriefingOverlay.tsx` to import.
- Unit test or manual regression: "Morning briefing is ready." preview, overlay subtitle, scrubber line-tracking still work.

**Effort estimate:** ~20 minutes.

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

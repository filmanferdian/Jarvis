# Backlog

Future features, pickup notes, and scope-later items. Mirrors the Notion Product backlog page. Newest entries at top.

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

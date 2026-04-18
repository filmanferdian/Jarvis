# Backlog

Future features, pickup notes, and scope-later items. Mirrors the Notion Product backlog page. Newest entries at top.

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

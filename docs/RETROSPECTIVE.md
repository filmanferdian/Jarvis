# Retrospective

Short "well / wrong / next" reflection per ship. Mirrors the Notion Retrospective log page. Newest entries at top.

---

## 2026-04-18 — v2.4.39 email draft blocklist

**Well:**
- Scope stayed tight. One behavior change (skip drafts for matched senders), one migration, one UI section. No feature creep.
- Seed script audit produced real signal: 14 Kantorku emails in the last 7 days, 1 wasted draft. Concrete proof the feature earns its keep.
- Worktree flow worked smoothly. Build passed first try; merge to main was clean.
- Prompt-injection defense audit confirmed the current body-text sanitization is sufficient — no security work was added to this ship even though the user asked about malware risk.

**Wrong:**
- Initial response didn't fully check whether attachments are handled before answering the user's question. Caught it before committing any code, but should be a reflex to verify-then-claim.
- Plan mode re-triggered mid-execution on the follow-up docs task. Lost a small amount of work context — needs attention if it keeps happening.

**Next:**
- Attachment-aware triage is now on `docs/BACKLOG.md`. When picked up, start with a security review before any code.
- Consider evaluating the blocklist on `informational` emails too — currently only `need_response` benefits, but there may be drafts Jarvis never attempts that still show up oddly classified.

---

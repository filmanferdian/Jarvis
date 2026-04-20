# Retrospective

Short "well / wrong / next" reflection per ship. Mirrors the Notion Retrospective log page. Newest entries at top.

---

## 2026-04-20 — v2.4.47 LTHR auto-sync for HR Zone 2 calculator

**Well:**
- Tight scope: one Garmin API call added, one new column, one fallback swap. Resting HR path was already correct, so I explicitly did not touch it.
- Verified end-to-end before calling it done — triggered the deployed cron endpoint and confirmed `garmin_daily.lthr = 166` landed for today's row, not just that the build passed.
- The `RawData.userSettings` field is optional, so existing backfill/re-extract paths that don't have user settings kept compiling with no code churn.

**Wrong:**
- First post-deploy sync trigger hit the old Railway build (deployed ~90s earlier, Next build takes longer). First check showed `lthr = null` and briefly looked like a response-shape bug. Should have verified the deploy completed before triggering.
- Merge collision with v2.4.48 ship that was happening in parallel — rebased and bumped to 2.4.47 mid-ship. Same class of drift flagged in the 2.4.48 retro.

**Next:**
- Add a `/api/health/version` unauthenticated endpoint (or use the existing dashboard header) to confirm the deployed commit before triggering validation syncs.
- Follow-up candidate: also sync `age` and `lactateThresholdSpeed` from `userSettings.userData` so the HR zones route stops hardcoding age=35.

---

## 2026-04-20 — v2.4.48 last-refresh timestamps on triage and contacts

**Well:**
- Tiny, surgical two-page change. Reused existing `latestCreatedAt` reducer on the triage route and the project's hardcoded WIB-offset convention — no new utilities, no schema, no migration.
- Caught the version collision at ship time: worktree branched off 2.4.43 but main had advanced to 2.4.47 mid-session. Rebased cleanly and bumped to 2.4.48 before merging.

**Wrong:**
- Started a fresh worktree while other sessions were shipping in parallel. Version bump had to be redone post-rebase. A `git fetch` + sanity check on `package.json` before committing would have avoided the collision.

**Next:**
- For short sessions, consider branching off `origin/main` directly after `git fetch` (not whatever `main` happens to be locally) to reduce version drift risk.

---

## 2026-04-19 — v2.4.44 → v2.4.46 OKR manual-entry chain

**Well:**
- Root-caused each failure layer in order: stray GET pre-flight (405) → OKR typeMap masking the saved rows → legacy rows orphaned by the typeMap cleanup. Each ship was small and reversible.
- Build validated locally before every push.

**Wrong:**
- First fix (v2.4.44) only addressed the save path. Didn't verify the read path would actually surface the new row — would have caught the typeMap bug in one ship instead of three.
- v2.4.45 removed the typeMap entries without auditing the DB for legacy data stored under old names. Broke OHS "2 counts" for the user. Should have grep'd the codebase and migrations for historical aliases first.
- The read/write naming convention in `health_measurements` has drifted over time (`dead_hang` → `dead_hang_seconds`, `ohs_major_compensations` → `overhead_squat_compensations`). No migration was run when the POST route's VALID_TYPES was renamed.

**Next:**
- Consider a Supabase migration that rewrites legacy `measurement_type` rows to canonical names, so the OKR canonicalization layer can eventually be removed. Flag for BACKLOG.md.
- Whenever changing `VALID_TYPES` in a write endpoint, audit all readers that filter on that column in the same ship.

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

# Retrospective

Short "well / wrong / next" reflection per ship. Mirrors the Notion Retrospective log page. Newest entries at top.

---

## 2026-04-20 — v3.0 post-release wrap (briefing preview, dashboard rhythm, versioning split)

Small wrap-up session catching three post-release issues after the main v3.0 consolidation and v3.0.1 mobile polish had landed.

**Well:**
- **Surfaced the versioning decision as documentation, not convention.** Filman said "3.0 on front-end, 3.0.x in codebase." Captured it in CLAUDE.md Versioning Discipline, added `VERSION.display` to `src/lib/version.ts`, and verified every UI surface binds to `.display` — two chips (TopBar, Sidebar) briefly were still on `.string` after a parallel session landed them first; caught on the audit pass.
- **Markdown-leak fix stayed 5 lines.** Inline `getPreview()` in `BriefingHero.tsx` instead of reaching for `src/lib/renderMarkdown.ts` (which renders HTML via `dangerouslySetInnerHTML` — heavier than a single-line subtitle warrants). One regex to skip heading-only paragraphs, one regex to strip inline bold.
- **Dashboard spacing ticket was bigger than the screenshot suggested.** The hero/KpiRow fused because only the downstream blocks had `mt-5` wrappers. Collapsed three separate spacing mechanisms into one `space-y-5` root stack — simpler and consistent.

**Wrong:**
- **Parallel ship raced me twice.** While I had the fix worktree open, another session merged v3.0.1 mobile polish (which also added `VERSION.display` and bumped to 3.0.1 independently). Second race: they shipped the TopBar/Sidebar version chips binding to `VERSION.string`, so I had to ship a tiny follow-up swapping to `VERSION.display`. Net work was ~3 merges where one would have sufficed if sessions coordinated on the chip API first.
- **Memory thrash on the version rule.** Wrote the rule as "two-part major.minor in package.json" after Filman said "only 3.x not 3.x.x". Had to rewrite the memory when he clarified with the codebase/front-end split. Should have asked "do you mean the display format or the package.json string?" before writing the memory.

**Next:**
- When starting a fresh session during an active multi-stream release, first `git log origin/main --oneline -15` to read what other sessions just landed — avoids the two-chip-rebind kind of race.
- When saving a new feedback memory that contradicts project CLAUDE.md, propose the CLAUDE.md edit in the same PR so convention and memory stay in sync from the start.

---

## 2026-04-20 — v3.0.2 briefing overlay readability + preload

**Well:**
- Screenshot-led diagnosis. Filman sent a single image showing `**Calendar Overview**`, orphan `1.` / `2.` rows, the 01–10 transcript rail, and `00:00 / 00:00` on the player. Three independent bugs, one image — confirmed all three fixes up front before touching code.
- One file touched. `BriefingOverlay.tsx` only. No API changes, no prompt changes on the briefing generator side. The markdown leak was strictly a rendering bug.
- Preload-on-open is the right mental model. Overlay open = intent to listen; zero reason to defer the fetch until the Play tap. Play now feels instant and scrubbing just works because the blob is already in memory.

**Wrong:**
- Accidentally ran `git add -A` from `/Users/filmanferdian/Documents/Jarvis` instead of the worktree path — got "nothing to commit" because main's working tree was clean. Fast to recognize and cd into the worktree, but another argument for always using `git -C <path>` on merge ships.
- Sanitizer's "drop heading-only short lines" rule is heuristic (≤4 words, no `.!?`). If the voiceover legitimately opens with a short declarative like "All clear." it will get dropped. Accepted because the voiceover prompt is already prose-first — but flagged for follow-up if it bites.

**Next:**
- Consider moving the sanitize + splitLines logic into a shared helper (`src/lib/briefingText.ts`) so any future briefing preview, card, or transcript rendering uses the same rules — `BriefingHero.tsx` already has a near-duplicate `getPreview()`.
- The briefing generator prompt could emit voiceover as already-sanitized prose so the client doesn't need to strip markers. Server-side would also let TTS skip them cleanly.

---

## 2026-04-20 — v3.0.1 mobile polish pass

**Well:**
- Triage-first kept scope honest. Spawned an Explore agent to grep inline grid styles, fixed-px widths, hardcoded font sizes; returned a prioritized top-10 with `file:line`. Worked from that list in one pass — no drift into speculative redesigns.
- All responsive logic is pure Tailwind (`sm:`, `md:`, `hidden`, `md:flex`, etc.) — zero `window.innerWidth` or `matchMedia` in render paths, so no SSR / hydration flash. The triage agent originally suggested JS-gated layout; pushed back on that.
- Master-detail pattern on `/emails` picked the simplest path: list visible when nothing selected, detail visible when selected, back button returns. Dropped the desktop auto-pick-first effect that was making mobile immediately show detail on load.

**Wrong:**
- Late conflict with a parallel session that shipped the version chip + `VERSION.display` to main while I was still in my worktree. Rebased cleanly but had to manually reconcile the `display` getter return format (chose "3.0" without "v" prefix, per main's version) and switch my call sites from `VERSION.string` to `VERSION.display`. If the CLAUDE.md versioning-split rule had been written *before* I started, the bump and call-site change would have been in my first commit.
- Cron log mobile layout took two edits to get the grid-`contents` pattern right. First draft had duplicate duration rendering; cleaned up on the second pass.

**Next:**
- Run the actual app at 375px (not just code audit) and capture screenshots — the triage is structural, not visual. There will be residual issues (line-heights, gap tightness, badge overflow) that only show up in the rendered DOM.
- Retire legacy v2 token aliases from `globals.css` (still a standing follow-up from the main migration).

---

## 2026-04-20 — v3.0 "Atmosphere" migration (Streams 1 + 2 + 3)

Single consolidated entry for the three-stream migration from v2 to v3.0 Atmosphere. Streams: (1) foundation + shell + dashboard, (2) health + cardio, (3) email + contacts + utilities. Versioning was collapsed to flat `3.0` post-merge at Filman's request — individual patch bumps (3.0.1 from Stream 3, 3.0.2 from Stream 2) were rolled back.

**Well:**
- **Parallel stream architecture held.** Three worktrees, three sessions, disjoint file scopes (Stream 1: shell + dashboard; Stream 2: `health/*`, `cardio-analysis/*`; Stream 3: `emails/*`, `contacts/*`, `utilities/*`). Zero file-level merge conflicts across all three streams. The "additive tokens" design (new Atmosphere vars layered alongside legacy v2 aliases) meant each stream's pre-merge build passed without stepping on the others.
- **Foundation-first gating worked.** Stream 1 pushed a minimal foundation commit (tokens + Space Grotesk + `Mindmap.tsx`) as the first merge to main. Streams 2 & 3 branched off that point, unblocking parallel work within ~45 minutes of plan approval.
- **Spec was the PR plan.** The design-system HTML's §12 was a file-by-file migration brief. Translating it 1:1 into the plan let each stream work independently against the same spec without re-litigating decisions mid-ship.
- **Neon-green discipline held.** 0 unsanctioned neon hits across the whole migration. Each stream audited its own scope; only the TopBar Online pill and the live-dot animation kept the reserved `--color-jarvis-live`.
- **Canvas port was cheap and visually faithful.** Porting the prototype `drawMindmap` and `drawRidgeline` directly beat rewriting in SVG/React.

**Wrong:**
- **Working directory drift.** Early in Stream 1 I did a `cd` to main for a merge, then subsequent `git mv` / `rm` / `mkdir` calls executed there instead of the worktree. Archive-page moves landed on main by accident. Caught before push because the build errored showing old imports — reset-hard on main, redid in worktree. Absolute paths via `git -C` would have prevented it.
- **Version bookkeeping churned.** Each stream ran its own `/ship` flow and patch-bumped independently (3.0.0 → 3.0.1 from Stream 3, then 3.0.2 from Stream 2). Filman then asked to collapse everything back to flat `3.0`. Net zero useful work. Should have agreed up-front whether parallel streams bump patches or hold for the final consolidated ship. Captured in the new CHANGELOG header as a convention going forward: minor only from 3.x onward.
- **Stream 2 didn't push its final merge.** Stream 2's `/ship` completed locally but its worktree branch wasn't merged to `main` + pushed — Stream 1 (this session) had to finish the merge manually during consolidation.
- **TypeScript narrowing bug in Stream 3's contacts helper.** TS inferred `bars` as `0[]` because every branch produced literal 0 or 1. Pre-rebase build passed; post-rebase build caught it. Should have typed the array explicitly first time.
- **Tone picker is cosmetic.** Without a per-thread regenerate endpoint, the Email Triage tone picker changes only local state. Faithful to spec but the feature is a shell. Backlogged.

**Next:**
- Retire legacy v2 token aliases from `globals.css` now that all pages consume Atmosphere tokens directly.
- Global neon-green grep sweep and mobile spot-check at 375px.
- Wire `POST /api/health/narrate` (backlogged) to feed real Claude-generated sentences into `HealthInsights`.
- Wire `/api/emails/drafts/regenerate?tone=...&triage_id=...` to make the tone picker do real work.
- Store provider-side draft URL on `email_triage` rows so "Send as-is" / "Edit" can open the specific draft.
- For future parallel-stream work: sessions **do not** patch-bump — the coordinating session batches everything under one minor bump at final ship.

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

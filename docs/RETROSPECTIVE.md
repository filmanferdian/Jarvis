# Retrospective

Short "well / wrong / next" reflection per ship. Mirrors the Notion Retrospective log page. Newest entries at top.

---

## 2026-04-25 — v3.7.1 / v3.7.2 / v3.8.1 — Cardio observability, lap classification, integer-cast fix

Three patches in one session, each enabling the next. User reported the cardio "Trigger Analysis" button couldn't pull the morning's run. Investigation found three layered problems: (1) the button silently swallowed sync failures, (2) the per-lap Notion table assumed every lap = 1km but the user had started using manual lap markers, and (3) running activities had been silently failing to upsert to Supabase since the table was created. Each fix unlocked visibility into the next.

**Well:**
- v3.7.1's per-record upsert warning (`[garmin] upsert failed for activity X: ...`) made the v3.8.1 bug obvious within an hour. Without it, the integer-cast failure could have run forever — every previous sync had reported "synced 5 activities" with no indication of failure. The lesson: if a `for ... of` loop in a sync path can silently skip records on error, log the error per-record. Not just the count.
- The lap classifier was designed test-first: dry-ran 6 scenarios in pure JS before committing the implementation. Caught a bug where the original heuristic (require pace below median for interval-work detection) failed for VO2 max sessions because rest laps drag the median pace toward work pace. Switched to HR-floor + duration + alternation, no pace check. Verified end-to-end after deploy by re-rendering the Apr 25 run, where the classifier correctly detected the natural tempo finish on L7-L8 purely from HR + pace, no manual press needed.
- Helper extraction (`buildActivityRecord`) deduplicated 4 identical activity-record builders in `garmin.ts`. Net diff was 40 lines added, 59 removed. The integer-rounding fix only had to be made in one place — and the missing per-record warning was added to the 3 sites that didn't have it (only `syncRecentActivities` had it from v3.7.1).

**Wrong:**
- The original CLAUDE.md "Versioning Discipline" rule says ship-stream bumps patch (`3.7.0 → 3.7.1`) — followed correctly. But the docs-of-record (CHANGELOG / RETROSPECTIVE / BACKLOG / Notion) were deferred to a consolidating `/ship` pass at the end. That kept the individual ships fast but meant docs were out of date for ~3 hours. Acceptable tradeoff; not a regression.
- During the v3.8.1 reproduction I overwrote one row's `raw_json` with test data (`{foo: 'bar', test: true}`). Realized only after running it. The next production sync after deploy restored real data automatically — but the right defensive move would have been to test against a stub activity_id, not a real one.

**Next:**
- Plumb the same per-record warning pattern to other sync loops (`emails`, `calendar`, `notionTasks`) — anywhere a for-loop upserts batches and only counts successes. Same silent-failure risk.
- VO2 max activity-level form averages (cadence, GCT, vert ratio) still get diluted by warm-up/cool-down inside the run. Re-compute these from `splits` filtered to `main + interval-work + tempo` segments. Backlog item.
- Per-segment decoupling for VO2 max sessions. Currently activity-level only with a fixed 3–5 min warmup exclusion. With segment classification now available, a per-segment decoupling read would be more useful for interval workouts. Backlog item.
- Surface segment labels into the Claude weekly-analysis prompt. The classifier knows which laps were "tempo" or "interval-work", but the analysis-engine prompt only sees per-run summaries. Could lead to richer "you nailed the tempo finish on Saturday" type feedback. Backlog item.

---

## 2026-04-24 — v3.6.0 Current Events: outlet blocklist per tab

User flagged low-value outlets cluttering the Indonesia and International feeds: sports niches (Fox Sports, Cleveland Browns, Bleeding Green Nation, NBC Sport), a pop-science aggregator (phys.org), and Indonesian clickbait outlets (Lentera.co, Qoo Media, Monitorday, detikHot, Bolasport, asatunews.co.id). Added a per-tab blocklist at the RSS ingestion layer so those sources are dropped before Claude ever sees them.

**Well:**
- Right layer for the fix. Blocklisting at ingestion (in `googleNewsRss.ts`) rather than at the synthesis prompt means blocked outlets never waste context tokens, never count toward outletScore, and never appear in the UI source chips. One place, one pass, done.
- Case-insensitive substring match catches spelling variants ("NBC Sport" vs "NBC Sports", "Bolasport.com" vs "Bolasports.com") without requiring exact names. This matters because Google News occasionally returns different formatted outlet names for the same publisher.
- Scrubbing related outlets (not just primaries) protects the coverage score from inflation by blocked outlets. Without that, a story covered primarily by NYT but also picked up by phys.org would show coverage N with phys.org contributing to the count.

**Wrong:**
- User's list had "Lenterea.co" but the actual outlet name in Google News is "Lentera.co" (missing the extra 'e'). Flagged the likely typo and added both spellings so the blocklist is robust whether the source name appears as the literal form the user gave or the real one Google News uses. Should probably surface this kind of match uncertainty back to the user as a confirmation rather than silently correcting, but the real-feed evidence was strong enough to assume.

**Next:**
- If the blocklist grows past ~15 entries per locale, consider moving it to a Supabase table or env-driven config so the user can edit without a code change.
- Consider the inverse: a per-locale allowlist of tier-1 outlets whose coverage adds an explicit score boost (distinct from just appearing in Google News's related bundle).

---

## 2026-04-24 — v3.5.0 Current Events: signals line + neutral voice

Two enhancements on user feedback after a few days of reading the v3.3.0 output: (1) surface quantitative rationale for why Jarvis picked these themes over others, and (2) strip personal-relevance framing from the synthesis prose ("this matters for Indonesian CEOs…" language was noisy). Both shipped as prompt changes plus a small `renderMarkdown` rule; no schema or cost change.

**Well:**
- The `outletScore` signal was already being computed in `googleNewsRss.ts` as the ranking key, but was never surfaced to the reader. Exposing it as "coverage N" in the UI closed that loop — the same number that determines "why this theme leads" is now visible to the user, which is the honest way to answer their question.
- Recurrence tracking is deterministic, not vibes. `fetchPriorThemes()` queries the last 6 stored slots, extracts the bold `**Title**` lines from each column, and hands Claude a structured prior-slot block to cross-reference. Claude classifies recurrence by comparing new-theme titles against that block. Verified: evening Hormuz story correctly tagged "ongoing 4 days" while one-off local stories tagged "new".
- Dropping `buildJarvisContext` from this one prompt simplifies it materially — fewer tokens, no personal-priority bias leaking into selection. The news synthesis is one of the few Jarvis surfaces where general analyst framing is genuinely more useful than personalized framing.
- UI rendering is subtle, not shouty. The signals line is a small muted monospace block under the bold title — reads as metadata, doesn't compete with the paragraph.

**Wrong:**
- First attempt at the signals definition asked Claude to "count unique outlets across the primary outlet plus the 'also:' list." Output showed "1 outlet" on almost every theme even when items had `also:` bundles — Claude was interpreting the instruction literally and not always counting the also-list correctly. Fixed by replacing the count-yourself instruction with "read the `outletScore=X` field directly from the pre-ranked list, don't recount." Claude recounting is an anti-pattern when the number is already deterministic.
- Today's dev-test feed happened to be thin — most themes showed `coverage 1`, which doesn't showcase the signal's range. Verified on the 2026-04-22 Hormuz crisis data that the signal DOES differentiate (coverage 6 across WSJ/CNN/NYT/Fox/Al Jazeera/Bahasa outlets), but first-read users on a slow news day may wonder if the number ever moves.

**Next:**
- Watch across a busy news day to confirm coverage values span a realistic range (1 to 8+) and the spread is visible in the UI.
- If the signal feels underused, consider surfacing the "discarded themes" too — a small footer line like "top 3 themes selected; 4 others below outletScore 3" — to make the selection rule even more transparent.
- Apply the same "show the rationale" pattern to the Email tab when it carries more than one newsletter (currently the Email signals line is optional; may want to surface `N newsletters · RECURRENCE` when there's material to show).

---

## 2026-04-23 — v3.4.0 Cardio analysis: Z5 calculator, walk filter, weekly-mix review

Three small tweaks batched after real use of the v3.0.8 "include treadmill" change surfaced rough edges: the HR Zone Calculator only covered Z2 but VO2 max intervals need a Z5 target band; incline-walk sessions were flowing into the running log because `treadmill_running` is also what Garmin tags an incline-walk; and the weekly review was nitpicking day-of-week adherence when the actual training happens across a flexible week.

**Well:**
- The Z5 band definition is the useful refinement. First cut used "highest floor → highest ceiling" mirroring Z2, but all six methods' ceilings collapse at max HR (~185), making the band trivial. Switched to "spread of floors" — lowest Z5 floor to highest Z5 floor — which is actually what you want to see: the entry zone into Z5 across expert opinions. 167–180 bpm is a useful target to aim at; 180–185 was not.
- Small pace filter, big signal cleanup. Single `secPerKm <= 600` check on the existing `activities.filter()` pulls incline walks out of VO2 max analysis without touching the activity-type allowlist or schema.
- Prompt trim, not regenerate. Loosening the weekly review to "weekly mix" was a surgical edit to the existing prompt — dropped two lenses, rewrote three section instructions, kept the progression-in-context lens (which is the useful part). No new plumbing.

**Wrong:**
- Edited the wrong repo first. All three edits initially went to `/Users/filmanferdian/Documents/Jarvis/src/...` instead of the worktree path. The dev server was rendering the worktree (unchanged), so the toggle didn't appear when I tried to verify. Caught it via `git status` in the main repo showing three modified files that shouldn't be there; saved as a patch, reverted main, applied to worktree. The CLAUDE.md rule "never edit files directly on the main working tree" exists exactly for this — I should have checked `pwd` before the first Edit.
- First Z5 consensus-band definition was wrong. Shipped "highest floor / highest ceiling" by analogy to Z2 without thinking through that Z5 ceilings all pin to max HR. User caught it and defined the right rule (min-of-floors to max-of-floors). Lesson: when copying a formula across domains, check that the inputs still mean what they did in the original domain.

**Next:**
- Watch next Saturday's weekly analysis to confirm the new prompt actually reads "weekly mix" rather than "you missed Tuesday's Z2." If still too plan-adherence-flavored, tighten the prompt further.
- One-time cleanup of historical incline-walk entries in the Notion Runs DB — the pace filter only affects future ingestions. Flag for BACKLOG.

---

## 2026-04-22 — v3.3.0 One-story-per-paragraph rule for news synthesis

Hours after v3.2.0 shipped, the first real read-through surfaced a problem: paragraphs were bundling unrelated stories. Two headlines that shared no cause or consequence would end up joined with a semicolon and a second topic sentence — "Russia halts Kazakh oil to Germany; Spirit Airlines rescue talks advance" — which read as a grab-bag list, not a synthesis. Fixed by tightening the prompt.

**Well:**
- Caught on first real use. The v3.2.0 POC runs looked fine because they happened on a busy news day with enough distinct stories to fill five themes cleanly. The real-slot run hit a thinner international feed, the "merge before pad" rule kicked in, and the failure mode became visible immediately. Short feedback loop.
- Prompt-only fix. No schema change, no new code path, no cost delta. Edited the synthesis prompt to ban semicolon-joined headline lists and to prefer 3 sharp themes over 5 padded ones.
- Re-verified before shipping. Triggered the evening slot with the new prompt, confirmed Indonesia returned 3 clean themes (e-KTP penalty, tax deadline, urea export) and International returned 4 (Hormuz, Fed nominee, Google Workspace Intelligence, SpaceX/Cursor) — each a single coherent story, no grab-bag paragraphs.

**Wrong:**
- Should have caught this in the POC. The v3.2.0 POC output I showed the user actually contained examples of this failure mode — "Dave Mason dies; Wembanyama concussion" was in the international section — and I didn't flag it. The user did. Padding shows up most visibly when the reader-lens filter (skip sports/obituaries) is weak, so I also tightened that.
- "Merge before pad" was a vague instruction. Claude interpreted it as "merge topically-adjacent items into one theme" rather than "cut low-value items." The revised rule is explicit: unrelated items go into separate themes or get dropped.

**Next:**
- Monitor the actual-cadence output for a few days. Is 3 themes too few on a thin slot? If yes, lower the minimum to 2 or allow even fewer rather than force synthesis.
- Apply the same "one story per paragraph" discipline to the Email tab when newsletters are sparse — today's evening Email tab had only one fragmentary NYT item and the synthesis correctly noted "no substantive newsletters," so this is likely already fine, but worth watching.

---

## 2026-04-22 — v3.2.0 Current Events tabs (Email / Indonesia / International)

The News card synthesised only Bloomberg + NYT newsletters. Extended to three tabs pulling Indonesia and International streams from Google News RSS, with analyst-brief BLUF-style paragraph synthesis, outlet-count pre-ranking, and Jarvis-context weighting. One Claude call produces all three tab outputs in tagged sections.

**Well:**
- **POC before plan locked.** Pulled both RSS feeds live, ran a real Claude synthesis against the fetched data, and iterated on prompt style (first pass was bullet-blurb with "Why it matters" labels; user pushed back; second pass was flowing top-down paragraphs that landed). Locked the final prompt rules into the implementation instead of guessing what the output would read like.
- **Strategy research up front.** Compared Perplexity Sonar, Google News RSS, and curated per-outlet RSS before picking. Picked Google News RSS once the POC showed native Bahasa coverage reaching Databoks, Hukumonline, Bloomberg Technoz, Humas Indonesia — sources Perplexity's English-biased index would have missed.
- **Ranking is not left to vibes.** Every RSS item carries an `outletScore` = number of unique outlets Google News bundled as covering the same story. Claude sees the pre-ranked list with scores visible, plus Jarvis context for priority weighting. Theme selection has an explicit signal, not pure prompt judgment.
- **Single Claude call for three outputs.** Kept cost and rate-limit budget identical to the old email-only synthesis by emitting all three tabs in tagged sections (`<<<EMAIL>>>` / `<<<INDONESIA>>>` / `<<<INTERNATIONAL>>>`) in one call, then regex-splitting the response.
- **Additive migration.** `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — no downtime, backward-compatible with existing rows, API route defensively falls back to legacy columns when new ones are null.

**Wrong:**
- **Env file drift.** Worktree was missing `.env.local` (CLAUDE.md warns about dual-env but I forgot on first cron trigger — got "Cron auth not configured" then "Unauthorized" before realising). Also initially truncated the `CRON_SECRET` with `head -c 40` when it was 64 chars. Two separate friction points against the same fix.
- **No cross-slot dedupe is a conscious design choice, but we haven't tested the failure mode.** If Hormuz keeps dominating for days, every slot will lead with it. User explicitly said developing stories should re-surface, so this is feature not bug, but we should watch in practice whether it creates fatigue.
- **UI verification blocked on auth gate.** Preview server rendered the auth screen; had to fish `JARVIS_AUTH_TOKEN` out of env, `preview_fill` it in, and click submit before I could see the actual tabs render. Minor, but every manual-UI-verify cycle pays this tax. A `NEXT_PUBLIC_DEV_AUTO_LOGIN` switch in dev mode would remove it.

**Next:**
- Watch the morning / afternoon / evening slots over a few days: is the 3-5 themes/tab cadence right? Does the "merge before pad" rule produce a jarringly short tab on slow days? Does cross-slot repetition feel coherent or redundant?
- BACKLOG: voice read-out per tab (current `voiceover` is Email-only, still pointing at legacy `synthesis_text`).
- BACKLOG: surface per-theme outlet URLs as click-through chips (the data is in `NewsItem.url` but not yet persisted or exposed).
- If International RSS feels shallow versus what Filman sees in his actual consumption, revisit Perplexity Sonar for that tab only while keeping Google News RSS for Indonesia.

---

## 2026-04-22 — v3.1.0 enable RLS on email_draft_blocklist

Supabase sent a CRITICAL security email: `public.email_draft_blocklist` had RLS disabled, meaning any holder of the project URL + anon key could read/write the table directly, bypassing the app. Fix was a one-liner — `ALTER TABLE email_draft_blocklist ENABLE ROW LEVEL SECURITY;` — applied via Supabase MCP. No app-code change needed because every write already goes through the service-role key, which bypasses RLS regardless of policies.

**Well:**
- **Advisor-driven triage.** Ran `get_advisors` before touching anything, confirmed only one ERROR-level lint (the one the email flagged) and separated it from ~25 WARN-level lints on other tables. Scope stayed surgical — one migration, one line.
- **Correct pattern choice.** Dropped the permissive `FOR ALL USING (true)` policy that migration-018 used as its template — that's exactly the anti-pattern the WARN advisors flag. Enabling RLS with no policy is both more secure and matches the existing acceptable `cron_run_log` precedent (INFO lint, tolerable).
- **Verified the fix.** Re-ran `get_advisors` after applying the migration — `email_draft_blocklist` moved from ERROR → INFO bucket. Closed the loop before writing any docs.

**Wrong:**
- **This shouldn't have been a surprise.** Migration-018 explicitly called out the "defense-in-depth RLS" pattern back when the codebase had fewer tables. Migration-021 (email_draft_blocklist, 2026-ish) and several tables since then were created without the `ENABLE ROW LEVEL SECURITY` line — drift from the established convention. No linter or pre-commit catches it; we only find out when Supabase emails.
- **No automated guard.** The Supabase CLI has a `db lint` command that surfaces these advisors, but it's not wired into CI or `npm run build`. Every new table will silently drift again until we add it.

**Next:**
- Add an item to BACKLOG: sweep the ~25 tables still on `FOR ALL USING (true)` policies and drop the policies. Service-role access is unaffected; this removes real anon-key exposure for tables like `google_tokens`, `microsoft_tokens`, `garmin_tokens`, `weight_log`, etc. — which DO contain sensitive data.
- Also BACKLOG: a lightweight `scripts/check-rls.ts` that hits the Supabase advisor API and fails if any ERROR-level lints exist. Cheap defense against silent drift.
- Pattern going forward: every new `CREATE TABLE` migration must include `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;` at the bottom unless there's a written reason.

---

## 2026-04-20 — v3.0.6 restore granular OKR objective cards

Reverted the v3.0.2 OKR Ridgeline (single canvas, 5 objectives × 14 days, synthesized history) back to the pre-Stream-2 per-objective card (current vs target, progress bar, status badge, baseline, context, trend arrow). Filman: "OKR Ridgeline doesn't work for me — need to shift to previous version with more granular insights."

**Well:**
- **Git history pulled the exact prior version.** `git show 29aab8d~1:src/components/health/OkrCard.tsx > <path>` dropped the 291-line granular card straight into the worktree with no hand-rewrite. Tokens already v3-compatible via legacy aliases in globals.css (`bg-jarvis-bg-card`, `border-jarvis-border`, `text-jarvis-success`, …), so the light-theme Atmosphere reading worked without visual rework.
- **Scope stayed narrow.** Only swapped the ridgeline block on /health for the per-objective grid. Narrative-readiness hero, 3-col health-grid headline metrics, blood-work panel, HealthInsights with narrative prop — all kept. Page still reads as v3.0 Atmosphere; only the detail surface changed.
- **Imported the old layout pattern faithfully.** O1–O4 in a 2-col grid, BloodWorkPanel between, O5 full-width at the bottom. Matches the pre-v3 information architecture the user already knew.

**Wrong:**
- **Version race on v3.0.5.** A parallel session merged `v3.0.5 — char-weight briefing subtitle timing` while I had my worktree open and tagged as v3.0.5 in both `package.json` and CHANGELOG. Rebase surfaced the CHANGELOG conflict cleanly, but I had to re-author the commit message, re-tag the CHANGELOG entry, and re-bump to v3.0.6. One `git fetch origin main --quiet` + version sanity check right before my first commit would have avoided the churn.
- **Ridgeline was built on synthetic data and I didn't flag the limitation up front.** The v3.0.2 ship interpolated a 14-day curve from the current `overall_pct` because no OKR-history endpoint existed. The visual fidelity of the ridgeline hid the fact that every curve was an ease-out line, not a real trajectory — exactly why it failed the first-real-use test. Should have surfaced "this is decorative until the history endpoint lands" in the v3.0.2 ship notes.

**Next:**
- If a per-day OKR progress endpoint is ever built, the ridgeline can return as a supplementary overview above the granular cards — compact sparkline on top, per-objective detail below. Not a goal for its own sake; only if the data exists.
- Minor: retire the `RidgelineObjective` type from the shared type surface if nothing else imports it (grep confirmed only the page + card used it; both removed).
- When a visual deliverable depends on data that doesn't exist yet, name the limitation in the first CHANGELOG entry so the next session doesn't have to rediscover it.

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

## 2026-04-20 — v3.0.5 char-weighted briefing subtitle pacing

**Well:**
- Tight, diagnostic-led fix. User reported "sub text on top is too fast" — went straight to the `ontimeupdate` handler, saw the equal-slice math, and the weighting fix fell out immediately. Two refs + a linear scan. No new dependencies, no prompt work, no server changes.
- Scrubbing continued to work without extra wiring because the range input writes `currentTime` and the existing `ontimeupdate` re-derives `lineIdx` from it. Deriving rather than storing is the right pattern here.

**Wrong:**
- The equal-slice math has been wrong since v3.0.2 when the line-tracking subtitle was added. Should have caught it at implementation: "does line index equal time index?" is a question I could have asked by looking at the math, not by shipping and waiting for a bug report.
- No unit test. "Given lines `['a', 'verylongsentence', 'b']` and cur/dur=0.5, line index should be 1" is a one-liner. Repo still has no test framework, so this stays as mental checklist rather than codified.

**Next:**
- If ElevenLabs is ever swapped for a TTS with non-linear pacing (rate adjustments, SSML pauses), revisit — char weighting may need per-line duration metadata from the TTS response.
- Consider exposing `lines` + `cumChars` through `src/lib/briefingText.ts` so any future briefing component (card preview tracker, etc.) uses the same pacing math.

---

## 2026-04-20 — v3.0.4 shared briefing text lib + server-side voiceover sanitize

**Well:**
- Clean backlog-to-ship path. Two related follow-ups from the v3.0.2 retro ("extract shared helpers" + "sanitize server-side") shipped as one coherent patch instead of two small ones — the shared helper is what makes the server-side sanitize a one-line call. Kept scope discipline: exactly the two backlog entries, nothing bolt-on.
- Defense in depth without over-engineering. Server-side sanitize runs at write time; client-side sanitize stays at read time. Historical `briefing_cache` rows continue to render cleanly, and fresh rows also save ElevenLabs characters by not feeding it markers in the first place.
- Prompt tightening matched the sanitize rules one-for-one ("no `**bold**`, no bullets, no `[SECTION]` markers") so the sanitizer should rarely have to strip anything from a well-behaved run — it's the belt that catches the suspenders slipping.

**Wrong:**
- Parallel session landed v3.0.3 (dashboard email synthesis restore) while I was in my worktree, causing a `package.json` conflict at rebase. Third time this week — clearly the default pattern when multiple sessions touch `package.json`. The new CLAUDE.md "two-phase rule" codifies what to bump to (now 3.0.x patches during this phase), but the conflict itself is still mechanical churn.
- `briefingPreview()` retains a slightly different rule than `sanitizeBriefing` + `splitBriefingLines` (it preserves short paragraphs, keeps the first paragraph whether or not it has sentence punctuation). That's correct — the hero's 200-char preview shouldn't filter out "No briefing yet." — but the asymmetry deserves a comment in `briefingText.ts` if it ever confuses someone. Added to the file but not flagged as a follow-up.

**Next:**
- When a new session starts and `package.json` is "close to" another session's version, stash the bump until just before commit. Reduces rebase surface.
- The sanitize + split helpers are now easy to unit-test — no test framework configured on this repo, so flagging as a "when we add tests" starting point rather than a blocker.

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

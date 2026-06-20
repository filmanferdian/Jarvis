# Retrospective

Short "well / wrong / next" reflection per ship. Mirrors the Notion Retrospective log page. Newest entries at top.

---

## 2026-06-20, v3.32.0, News outlet blocklist expansion from a 14-day source audit

Audited the outlets pulled into the Current Events feed (41 slots over 14 days, both tabs) to find non-current-events noise, then expanded `BLOCKED_OUTLETS` by ~48 entries. Set up a weekly scheduled review (Sunday morning WIB, over the previous 7 days, run from the Claude app) to keep proposing candidates for confirmation, without auto-editing.

**Well:**
- Verified the existing filter was actually working before adding to it: already-blocked outlets only showed in pre-Jun-8 rows and nothing leaked in the last 3 days, so this was confirmed as curation, not a bug chase.
- Treated Supabase query output as untrusted data (outlet names came from external feeds) and reasoned over it without executing anything embedded.
- Caught two matcher subtleties rather than blindly appending: `pontianakpost` (no-space) was silently leaking past `'pontianak post'`, and a bare `'ign'` would have wrongly blocked "Foreign Policy" via the substring matcher.

**Wrong:**
- The substring matcher (`n.includes(b)`) is the root weakness behind both the pontianakpost gap and the ign risk. The blocklist keeps growing by hand because there is no word-boundary match and no structural rule for the long tail of one-off hyper-local outlets.

**Next:**
- Add a word-boundary matcher so short distinctive tokens (ign, and future ones) can be blocked safely. Backlogged.
- Decide the Tier-3 borderline outlets (detik tech vertical, Apple/gadget-rumor blogs, US regional papers) and consider a "seen once, no corroboration" heuristic to kill the hyper-local long tail instead of hand-listing. Backlogged.
- The review runs as a Claude app scheduled task (laptop-dependent: fires while the app is open, or on next launch). A true server-side version was considered (a cron-job.org-driven endpoint on Railway) but deliberately not built; keeping it in the loop/scheduled-task layer was the chosen tradeoff. Pre-approve its tools with a Run-now so future Sunday runs do not pause on permission prompts.

## 2026-06-20, v3.31.0, Fix retired Sonnet model id; centralize model config

Claude Sonnet 4 (`claude-sonnet-4-20250514`) retired 2026-06-15, 404ing every Claude call that still hardcoded it: morning briefing, email triage, and email synthesis were failing in cron, with several on-demand routes latently broken. Diagnosed from the Utilities page → `cron_run_log` / `sync_status` error text, confirmed the retirement against the model reference, then centralized the id into one `CLAUDE_MODEL` constant (`claude-sonnet-4-6`) consumed by all 14 call sites.

**Well:**
- Read the actual error before theorizing: the `not_found_error` payload named the dead model id, which immediately ruled out "API access / credentials" and pointed at a retired model.
- Checked the whole blast radius (grep found 14 hardcoded ids, not just the 3 visibly-failing jobs) and verified the swap was safe (no prefills / `budget_tokens` / sampling params that 4.6 rejects) before editing.
- Fixed the root cause (scattered string literals) not just the symptom, so the next retirement is a one-line change.

**Wrong:**
- The id was duplicated across 14 files in the first place; a single retirement took down multiple core features. Should have been centralized from the start.

**Next:**
- Model/effort are now tuned per task in the same ship (Haiku for voice intent, triage classification, and job scoring; Sonnet at `low`/`medium`/`high` effort by task) rather than everything at the implicit `high` default. Monitor real token usage on the Utilities page after a few cron cycles and adjust tiers if quality or cost looks off.
- The Quran synthesis route moved from `claude-sonnet-4-5` to `claude-sonnet-4-6` and was left at default effort; that endpoint is Ubayy-owned, so flag both the model change and the Haiku/effort recommendation to Ubayy.

## 2026-06-19, v3.30.0, Quran synthesis: harden the length cap

Another Ubayy prompt edit to `POST /api/quran/synthesis`: turned the length guidance from a "firm limit" into a "hard cap" (about 1000 words, never above 1100, even on long or dense portions, selectivity over exhaustiveness) and softened the Meaning section's "give it the most room" wording that was pulling toward overruns. Four-section shape unchanged.

**Well:**
- Read the diff and recognized it as a tuning follow-up to v3.29.0's longer Meaning section: the deeper Meaning was overrunning on dense portions, so this caps it. Framed the changelog around that intent rather than as an isolated wording change.
- Confirmed the version label with the user before this ship after last turn's minor-versus-patch mix-up, so v3.30.0 was a deliberate choice, not a surprise.

**Wrong:**
- Fifth same-day ship of this one endpoint, still arriving as edits in the main worktree from Ubayy. The handoff guardrail (Ubayy gets its own worktree or a PR flow) is still not in place, so the manual move-to-worktree step repeats.
- Each tiny prompt tweak consumes a full minor bump under `/ship`; the version is climbing fast for prompt-only changes. `/ship-stream` (patch) is the lighter cadence if the user prefers it for these.

**Next:**
- Give Ubayy its own worktree or a pull-request handoff.
- Wire the endpoint into the briefing or 15:30 callback (pending since v3.27.0).

## 2026-06-19, v3.29.0, Quran synthesis: four-section deep-dive structure

Coordinator ship that also reconciles Notion after the v3.28.1 ship-stream (per-section word budgets) deferred its Notion mirror. The v3.29.0 change itself is another Ubayy edit to the synthesis prompt: dropped the Key terms and Cross-references sections, folded them into a deeper Meaning walk-through (budget ~450 to ~700 words), so the note is now four sections.

**Well:**
- Read the diff before shipping and caught that this is a consumer-visible format change (two headings removed), so the CHANGELOG and Notion entries call it out for Ubayy rather than describing it as a silent tweak.
- Used the coordinator ship to close the Notion version lag (was stuck at v3.28 while code moved to 3.28.1 then 3.29.0) in one pass.

**Wrong:**
- Four same-day ships of one endpoint, all originating as edits in the main worktree. The cross-system handoff with Ubayy still has no guardrail, so each lands as untracked or modified files I move to a worktree by hand. This is now a clear pattern, not a one-off.
- The per-section budgets shipped in v3.28.1 were obsolete within the same day, so that patch carried little lasting value on its own.

**Next:**
- Give Ubayy its own worktree or a PR-based handoff so its edits stop landing directly on main.
- Still pending since v3.27.0: wire the endpoint into the briefing or 15:30 callback so it is actually invoked.

## 2026-06-19, v3.28.0, Quran synthesis: longer five-minute read

Same-day follow-up to v3.27.0, again originating as a Ubayy edit left in the main worktree. Lengthened the synthesis target to 1000-1100 words, switched the Meaning section to thematic clusters, added a firm "finish all six sections" length rule, and raised max_tokens to 4096.

**Well:**
- Confirmed the diff was scoped to exactly the prompt text and the token cap before shipping, so the minor bump carried no hidden behavior change.
- Reused the now-established flow: fast-forward the worktree branch to main, copy the edit in, bump, document, build, merge.

**Wrong:**
- Second same-day ship of the same endpoint from Ubayy writing into the main worktree. The handoff still has no guardrail, so each refinement repeats the move-to-worktree cleanup by hand.
- The 4096-token cap leaves little headroom for a 1100-word output plus Arabic; if outputs ever truncate, the cap is the first thing to raise.

**Next:**
- Wire the endpoint into the briefing or 15:30 callback (still pending from v3.27.0).
- Consider giving Ubayy a worktree to write into so these stop landing on main.

## 2026-06-19, v3.27.0, Quran: on-demand daily reading synthesis endpoint

Shipped a Ubayy-authored `POST /api/quran/synthesis` route that generates the daily Sunni-tafsir reading synthesis and caches it per `(user, date)`. Work was produced by the Ubayy system (a separate Quran reader that piggybacks on Jarvis's Anthropic API) and left as untracked files in the main worktree; this session moved it into a Claude worktree, added the missing migration, and shipped.

**Well:**
- Verified the route against the real codebase before shipping: confirmed `checkRateLimit` / `trackServiceUsage` / `incrementUsage` exist, the `quran_synthesis` table is live in prod, and the schema (columns, `UNIQUE (user_id, date)`, RLS) matches what the route assumes for its upsert.
- Caught the schema-sync gap: the table existed in prod but had no migration file, so I added an idempotent backfill (migration 033) rather than a plain CREATE that would have failed on re-run.

**Wrong:**
- Ubayy writing code straight into the main worktree (alongside a separate untracked AGENTS.md, a Codex-format file with templated "Codex API" errors) is exactly the branch-discipline hazard CLAUDE.md warns about. Caught it, but the cross-system handoff has no guardrail yet.
- The endpoint ships with no caller, so it is reachable but inert until wired into the briefing/cron.

**Next:**
- Wire the synthesis endpoint into the briefing and/or 15:30 callback.
- Backfill migrations for the other drifted Quran tables (`quran_progress`, `quran_plan`, `quran_plan_days`).
- Decide whether AGENTS.md belongs in the repo; if so, fix its copy-pasted errors first.

## 2026-06-08, v3.26.0, News: blacklist six non-current-events outlets

Added TMZ, Chapelboro.com, DawgNation (International) and pdiperjuanganbali.id, Gerbang Indonesia, gamereactor.asia (Indonesia) to the existing `BLOCKED_OUTLETS` filter in `src/lib/sources/googleNewsRss.ts`, so they drop out of news synthesis and no longer count toward outletScore. ESPN and detikInet were flagged but kept at the user's request.

**Well:**
- The blacklist mechanism already existed, so the change was six list entries plus comments, no new code paths. Reused the case-insensitive substring matching that already handles spelling variants.
- Sorted the candidates into clear tiers (not-news vs niche-but-legit) before recommending, so the user could make a fast, informed cut.

**Wrong:**
- Pre-bumped the version as a patch (3.25.1) before the ship; the project's tool-keyed rule makes `/ship` a minor bump, so I corrected to 3.26.0 and reopened the section. Minor friction, no harm.

**Next:**
- Watch for new low-quality outlets surfacing in the feed and extend the list as needed; the filter is the right home for it.

---

## 2026-06-08, v3.25.0, Investments: market cap + net income columns, sorted by market cap

Added a market cap column (GOOGLEFINANCE, automated) and a last-FY net income column (manual, researched) to the investments table, with each industry group ordered by market cap descending. Threaded two fields through the sheet, parser, quote types, a new migration, the sync, and the page.

**Well:**
- Reused the proven 7d/30d threading pattern end to end, so the change was mechanical and low-risk; the build passed and the cron priced 51/51 on the first local run.
- Built the market cap column by copying column B and find-replacing price to marketcap, avoiding 50 hand-typed formulas. Verified the data in Supabase before shipping rather than trusting the UI.
- Confirmed the exact sheet row order from the published CSV before pasting net income positionally.

**Wrong:**
- First net income paste relied on blank lines for the two non-watchlist rows (ASSA, JSMR) and shifted the whole US block up by one. Caught it on spot-check and re-entered in two contiguous blocks. Lesson: do not rely on empty cells to advance during a positional paste.
- GOOGLEFINANCE IDX market caps come in lower than headline figures (its price feed quirk), so absolute IDX market caps are understated; flagged to the user and backlog.
- The auth-gated page blocked a local visual screenshot (declined to type the dev token), so verification leaned on the data layer plus the build.

**Next:**
- Net income is static; refresh after each annual results season (backlog).
- If the IDX market cap understatement affects ordering, switch IDX market cap to manual or a fundamentals source (backlog).

---

## 2026-06-08, v3.24.0, Investments: five new IDX watchlist names

Added ASII, BNLI, EXCL, DCII, and AMRT to the investments watchlist, with a renamed Tech group (GOTO plus DCII) and a new Retail group, mirrored on the Notion Investment page. Source-sheet rows added; valuations still pending.

**Well:**
- Confirmed placement with the user before writing (transport grouping for ASII; DCII folded into a renamed Tech group), so the data model did not need rework.
- Caught that main had already minted 3.23.0 from a parallel session; fetched and fast-forwarded before bumping, so the version landed at 3.24.0 with no conflict (the other commits only touched valuation skill files).

**Wrong:**
- Created a standalone Data centers group first, then folded DCII into Tech a step later. Asking the grouping intent up front would have saved an edit.

**Next:**
- Run valuations for the five new names so fair value and verdict stop showing dashes (backlog).
- Confirm the GOOGLEFINANCE rows price correctly on the next quotes cron slot.

---

## 2026-06-08, v3.22.10, Investments: live gap from last price to fair value

The upside percent next to each verdict was reading the stored Notion Upside property, frozen at valuation time, so it never moved as the live price changed. Now computed live as (fair minus last) over last, in the watchlist row and the detail view, with a fallback to the stored value when there is no live quote.

**Well:**
- Confirmed the staleness from the render path before touching anything: the cell bound to the stored Upside property while the Last price column right next to it was live. Diagnosis first, then a one-helper fix.
- Kept it surgical: one shared helper, fallback to the stored value, verdict badge left as the analyst's call. Build passed first try.

**Wrong:**
- Left the verdict badge static while the percent is now live, so a large price move could make the badge and the gap disagree. Chose surgical over re-deriving the band; it is a latent inconsistency, flagged to backlog.
- Main advanced twice underneath me from parallel sessions; the first fast-forward merge failed and I had to rebase. No conflict (the other commit only touched skill files), but a reminder to fetch and rebase right before merging on a busy repo.

**Next:**
- Optionally re-derive the verdict band from the live gap so badge and percent stay consistent (backlog).
- The Fair value low/high follow-up from 2026-06-05 looks addressed by the same-day valuation skill update; confirm and close it.

---

## 2026-06-07 — v3.22.4–3.22.7 — Investments: multi-period price + explicit fair value

Added 1D/7D/30D price changes and an explicit fair value (plus range and as-of date) to the investments page, added ISAT and dropped ASSA/JSMR, and sourced the 7d/30d history from two new GOOGLEFINANCE columns in the published sheet. Shipping it took four patch versions because firing the cron against live data exposed bugs the build could not catch.

**Well:**
- Did not blind-merge when a parallel ship had replaced the quote source (Yahoo to Google Sheet + SGX) underneath me. Read the new architecture first, then re-based the feature onto it instead of forcing a stale merge.
- Each fix was driven by evidence from the live fire and Supabase reads, not guesswork: percent format (CSV showed -6.45%), comma-in-quotes (TLKM stored as 2), and the 5-minute edge cache (cache-control max-age=300).
- Made the parser robust rather than format-dependent (percent-aware + quote-aware + cache-bust), so future sheet-formatting or cache quirks cannot silently skew values.

**Wrong:**
- Editing the sheet introduced the percent/comma formatting that broke parsing, and the first cron fire briefly stored corrupted IDX prices in prod (TLKM as 2). A dry run of the parser against the real published CSV before firing prod would have caught all three issues at once.
- Took four deploys to converge. Verifying the end-to-end parse against the live CSV up front would have collapsed v3.22.5–3.22.7 into one.

**Next:**
- SGX names have no 7d/30d history (1D only). Consider a Supabase price-history table as a source-independent backstop so all exchanges get multi-period changes (now on BACKLOG).
- The cron blanks 7d/30d if a single fetch misses them (no preserve-on-null). Consider preserving prior non-null values on a partial fetch (now on BACKLOG).

---

## 2026-06-05 — v3.22.3 — Investments page manual Refresh button

Ran a stage-by-stage equity DCF on BBRI (bank, so equity cash flow discounted at cost of equity, not enterprise DCF), published it to the Notion DCF library, then found it did not surface on the Jarvis investments page. Root cause was a day-keyed in-memory cache in the valuation reader; added a manual Refresh button so new valuations appear on demand.

**Well:**
- Read the actual reader/route/watchlist code before answering "why hasn't it updated" instead of guessing the integration was broken. The cause (UTC-day cache) was provable from the source.
- Matched the fix to the user's stated cadence: they refresh roughly weekly, so a button beat a short TTL that would re-hit Notion every few minutes for no benefit.
- Caught that stored quotes read straight from Supabase (no cache), so the button only needed to bust valuations, keeping the change surgical.

**Wrong:**
- Shipped the code as a lean manual push (version + CHANGELOG only) and skipped the retrospective, backlog, and Notion mirror. The user had to ask "have you done the ship protocol?" to get the close-out done. Should have either run the full protocol or stated clearly that the ship was intentionally partial and tracked the remainder.
- The valuation skill created the Notion page without the Fair value low/high properties, so the investments range column would have shown a single number until I backfilled them by hand. The skill should populate the range. Flagged to BACKLOG.
- Did not verify the deploy on the live page (auth-gated); relied on the build. Acceptable, but the "verified desktop + mobile" bar was not met.

**Next:**
- Update the valuation skill to set Fair value low/high when it creates the Notion page (now on BACKLOG).
- When doing a quick manual push on a project with a strict Definition of Done, decide up front: full ship or explicitly-partial with the remainder tracked. Do not leave the close-out implicit.

---

## 2026-05-31 — v3.22.2 — Investments quotes: Google Sheet (US+IDX) + SGX API

The Investments price pull was storing zero prices: Yahoo returns HTTP 429 from datacenter IPs. Replaced it with a published Google Sheet of GOOGLEFINANCE formulas for US + IDX and SGX's own public JSON feed for the three Singapore banks. Both are key-free and reachable server-side.

**Well:**
- Probed providers before committing: confirmed Yahoo blocked on both IPs, Twelve Data free is US-only (IDX/SGX gated to a $229/mo plan), GOOGLEFINANCE no longer covers SGX, then found SGX's own feed works server-side. The chosen design fell out of evidence, not assumption.
- The sheet offloads per-symbol fan-out to Google, so the app makes one CSV fetch instead of 47 throttled calls; no rate-limit handling needed.
- Upsert-only-priced guard and per-source graceful degradation mean a flaky source never blanks good data.

**Wrong:**
- Building the sheet via browser automation hit two avoidable detours: clipboard writes fail on a non-focused tab, and Google Sheets' Tab-to-next-cell anchor resets across automation batches, which scrambled columns the first time. Fixed by entering data in self-positioning per-batch runs.
- Initially trusted the "Twelve Data free covers 50+ exchanges" headline; the free tier is effectively US-only. Verifying the actual symbols earlier would have saved a round.

**Next:**
- Verify the prod cron run populates `investment_quotes` (priced > 0) after deploy.
- GOOGLEFINANCE is ~15-20 min delayed and unofficial; if it drifts, revisit a paid provider (EODHD ~EUR 20/mo) for reliability.

## 2026-06-01 — v3.22.1 — Prompt-injection hardening for email and delta prompts

Closed the remaining high-priority prompt-injection item from the 2026-05-31 security review. The manual email synthesis, email style-analysis, and briefing delta prompts now sanitize external fields, wrap externally sourced content with `wrapUntrusted`, and include the shared untrusted-content preamble.

**Well:**
- The change stayed narrow: three prompt surfaces plus one small validation schema for the caller-provided email synthesis payload.
- The existing `promptEscape` helpers fit cleanly, so this is mostly standardization rather than new security machinery.
- Build verification caught no regressions; the only output is the already-known Next middleware deprecation warning.

**Wrong:**
- The manual email synthesis endpoint had no runtime input schema, so prompt hardening also needed a small body contract before sanitization.
- The style-analysis endpoint analyzes sent mail, but sent bodies can contain quoted external replies. Treating that path as untrusted is the safer rule, even though the primary author is Filman.

**Next:**
- Pick up the older B/C security findings: rate limits for sync/briefing/contact/cron routes, plus zod schemas and body-size caps for the remaining POST handlers.
- Keep session-token redesign separate; it is more architectural and should not be bundled with request-boundary cleanup.

## 2026-05-31 — v3.22.0 — Security hardening: OAuth starts, Garmin scripts, dependency audit

Implementation commit: `6dbecb78a6eb129721135d17ae5035104b883822`.

Shipped the first high-priority security batch: OAuth start routes now require Jarvis auth, Garmin local scripts use service-role-only encrypted storage, daily backfills encrypt raw Garmin payloads, and the dependency audit is clean after Next/transitive updates.

**Well:**
- The OAuth change stayed narrow: only the connect start routes moved behind `withAuth`, while callbacks remain public and protected by the existing signed state cookie flow.
- The Garmin script cleanup now matches app storage: one script-side crypto helper uses the same `enc:v1` AES-GCM envelope, tokens land only in `garmin_tokens.tokens_encrypted`, and missing service-role credentials fail before any Garmin call.
- Dependency remediation is explicit and inspectable: Next is on 16.2.6 and the vulnerable transitive packages resolve to patched override versions. Audit now reports zero vulnerabilities.

**Wrong:**
- `garmin-connect` is CommonJS in these scripts, so the cleanup also needed an import-shape fix while touching the files. Low risk, but it was adjacent rather than part of the original security scope.
- The build still prints Next's middleware-to-proxy deprecation warning. It does not block the ship, but it is a future framework-maintenance chore.

**Next:**
- Pick up the remaining high-priority security item: standardize prompt-injection defenses in email synthesis, email style analysis, and briefing delta prompts.
- Then roll through the older backlog security leftovers: rate limits, zod/body caps, session hardening, Origin/Referer checks, and login backoff.

## 2026-05-30 – v3.21.0 – Investments watchlist (last price vs fair-value range, drill-in memos)

New /investments page: a watchlist grouped by exchange and industry, each row showing the last price against the valuation fair-value range with a verdict and a drill-in to the full memo. Valuations and memos read live from Notion; prices are refreshed by a cron a few times a day and stored, not pulled live.

**Well:**
- Reused existing patterns end to end: the Notion REST reader mirrors the other Notion syncs, the cron route uses the same withCronAuth plus runCronJob wrapper as every other job, and the page leans on AppShell and existing card styling. Little new plumbing.
- Switching prices from live-on-load to a stored cron refresh hit two goals at once: it matches the fundamental-investor cadence the user asked for, and it sidesteps the Yahoo rate-limiting that blocks the dev IP, since pulls become infrequent and run from Railway.
- Upserting only priced rows means a transient upstream failure leaves the last good price in place instead of blanking the column.

**Wrong:**
- Could not exercise the populated price path locally: Yahoo rate-limits this dev IP and the quotes table is empty until the first production cron run, so the price column shows placeholders until then. Verified structure, fair-value range, verdict, and the drill-in memo, but not live prices end to end.
- The watchlist universe lives in code while valuations live in Notion, joined by ticker. Fine for one user, but a ticker typo on either side silently shows "No analysis" with no warning.

**Next:**
- After the first cron run, confirm prices populate for all three exchanges (IDX, SGX, US). If Railway's IP is also rate-limited by Yahoo, add a keyed provider (Twelve Data covers IDX, SGX, US on a free tier) as a fallback.
- Set up the cron-job.org schedule (WIB runs covering each exchange's mid-day and close).

## 2026-05-30 — v3.20.2 — Career data-pull health check (page + Utilities)

Surfaced per-source data-pull health on the Career page (a "Sources" strip with status dots and fetched counts) and under Utilities (a Career Job Watch connector card with the six sources).

**Well:**
- Almost no new plumbing: the sync already wrote per-source result/error/count to sync_account_status under sync_type career-jobs, and sync_status already had the career-jobs row. So this was mostly surfacing existing data — one field added to the career API, a strip component, one expected-interval entry, and a label prettify.
- The strip shows the raw fetched count, which cleanly separates "source is broken" from "source works but has no senior matches." GoTo (12) and Stripe (62) read as healthy green even though they currently contribute zero roles after the seniority filter, which is exactly the right signal.
- Reused the existing ConnectorCard for Utilities, so the career card looks identical to every other integration with zero new UI risk.

**Wrong:**
- Verified the Utilities card via the API plus the known-good ConnectorCard rather than a live browser render, because that page only fetches on mount and needs real auth, which makes a preview-mode mock fiddly. Low risk here, but it is the second time this session that the auth-gated, mount-only pages have been awkward to eyeball.
- The Career Job Watch connector now sits at a permanent "warning" because Revolut (best-effort) always errors. Correct as a raw health view, but Utilities does not know Revolut is intentionally best-effort, so the amber is slightly louder than it needs to be.

**Next:**
- If the permanent Revolut amber on Utilities becomes noise, teach the integrations API about best-effort accounts so an expected failure reads as informational rather than a warning.
- A small preview-mode auth shim (NEXT_PUBLIC_DEV_AUTO_LOGIN, already on the backlog) would make these mount-only authed pages verifiable in the browser.

## 2026-05-30 — v3.20.1 — Stricter seniority filter + facet z-index fix

Follow-up to v3.20.0 from a mobile screenshot. Replaced the below-bar exclude with a positive seniority gate (keep only Head/VP/GM/Director/Lead-level), added legal/audit/accounting/tax to the hard-excludes, un-excluded architecture, and fixed the facet dropdown rendering behind the wrapped-row buttons.

**Well:**
- Switched from "exclude the junior words" to "require a senior word," which is both simpler and exactly what Filman asked for (no Manager). Verified 19 title cases including the tricky ones (General Manager kept, Senior Manager dropped, Director Accounts Receivable kept while Senior Accounting Manager dropped, architecture kept while engineering still excluded).
- The re-scan did the cleanup for free: the new filter closed the 46 now-disqualified rows via the existing close-detection, then a single delete swept them. The watch self-corrected to 30 fully-scored senior roles with no hand-curation.
- Caught that the result is genuinely better, not just smaller: the OpenAI fit held, and Grab surfaced real Jakarta strategy/product roles (Head, Jabo Mobility Strategy; Lead Product Manager) that the looser filter had buried under sub-Director noise.

**Wrong:**
- The z-index bug shipped in v3.20.0 because I only verified the facets on desktop, where all four sit on one row and the dropdown never overlaps a sibling button. On mobile the bar wraps and the dropdown rendered behind the second-row button. Should have checked the wrapped mobile layout before shipping a new dropdown component.
- GoTo and Stripe both dropped to zero under the seniority bar. Correct for now (their current SG/Jakarta openings are all Manager/specialist/audit level), but a source showing zero is worth a glance to confirm it is the filter, not a fetch regression.

**Next:**
- If GoTo/Stripe stay at zero for several scans, consider surfacing a small "0 senior roles right now" note per source so an empty company reads as intentional rather than broken.
- The work-type taxonomy keeps growing by hand (now 13 categories); fine, but it is the kind of map that drifts, so revisit when adding the next source.

## 2026-05-30 — v3.20.0 — Career filters + Singapore/Jakarta base restriction

Restricted the watch to Singapore/Jakarta-based roles only (Filman confirmed those are his only acceptable bases, Jakarta preferred) and added four client-side filter facets to the page: Company, Base, Scope (mandate breadth), and Type of work (normalized function taxonomy).

**Well:**
- The base restriction and the budget fix turned out to be the same lever. Tightening the gate from SEA+APAC to Singapore/Jakarta cut the watch from 145 to 75 kept, which both matches Filman's actual relocation constraints and keeps the per-run scoring well under the daily Claude budget.
- Built all four facets client-side over the fields the API already returns, so no migration, no sync change, no backfill. Derivations (base, mandate scope, normalized work type) are pure functions, easy to test and adjust.
- Verified each facet in the browser with realistic mock data before shipping: Base=Jakarta correctly dropped the Singapore roles, and the work-type taxonomy bucketed the four sample roles into Policy, GTM, Risk & Audit, and Strategy as intended.

**Wrong:**
- Asked the user for the geo-scope and work-type definitions, and the answer also redefined the gate ("only Jakarta or Singapore"), which contradicted the earlier "SEA is relevant" call. Re-reading both, the requirement genuinely shifted as Filman thought it through; a single up-front "where would you actually relocate" question at the very start would have avoided the SEA detour and the two rounds of row deletion.
- Facet counts are computed over the closed-filtered set only, not cross-filtered by the other active facets, so a count can read higher than what a combined selection actually shows. Acceptable for now, but slightly misleading.

**Next:**
- Optionally prioritize Jakarta-based roles above Singapore within each company group, since Jakarta is the preferred base.
- Cross-filter facet counts so they reflect the other active selections.
- The work-type taxonomy is a hand-maintained keyword map; revisit if a new source brings titles it classifies as Other too often.

## 2026-05-30 — v3.19.3 — Grab and GoTo sources + below-bar title pre-filter

Added Grab (SmartRecruiters) and GoTo (gotocompany.com JSON API) as the fifth and sixth sources, and introduced a seniority pre-filter to stop high-volume employers from flooding the scorer.

**Well:**
- Probed the four ATS APIs first: Grab is on SmartRecruiters, and GoTo's client-rendered SPA turned out to be backed by a clean public JSON endpoint found by reading its careers bundle. No scraping needed for either.
- Caught the volume problem before shipping rather than after: Grab alone passed 189 in-region roles, which would have dominated the shared 40-per-run Claude budget on Tue/Thu scan days, right before the briefing. Added a below-bar title filter aligned with Filman's Director/Head bar, with a senior-override so "Associate Director" and "Chief Risk Officer" survive. Verified against 16 cases before scanning.
- The first scan produced a genuine fit (OpenAI Head of APAC Growth Markets, 85) plus Grab strategy partials, so the default view is now populated.

**Wrong:**
- A high-volume source plus the 40-per-run cap plus the 50-per-day shared Claude budget is an awkward combination: 145 kept means scoring takes roughly four scan-days to catch up, and each catch-up run eats most of the day's budget right before the morning brief. The pre-filter helps but the structural tension remains.
- Grab's list endpoint has no job description, so those roles score on title alone, which is weaker. The three Grab partials are plausible but lower-confidence than the JD-backed OpenAI ones.

**Next:**
- Decouple career scoring from the shared daily Claude budget, or schedule the career cron well clear of the 07:30 briefing window, so a big catch-up run cannot starve the morning brief.
- Optionally enrich Grab roles with the SmartRecruiters detail endpoint (JD) for kept roles only, to lift scoring confidence without fetching all 348 descriptions.

## 2026-05-29 — v3.19.2 — OpenAI added as a fourth career source

Broadened the watch to OpenAI. It runs on Ashby's public posting API, so it dropped in next to the Anthropic Greenhouse source with no scraping.

**Well:**
- Probed the four common ATS APIs first and found OpenAI on Ashby (708 roles), so no scraping was needed. Validated the source plus the in-region gate offline (21 kept of 708) before spending any paid scoring.
- Folded secondary locations into the location string, so a role offered in both Sydney and Singapore still passes the gate on Singapore. The first scan produced 4 in-region partials, a real improvement over the empty post-cleanup state.

**Wrong:**
- The dev server dropped twice mid-session, so the first scan attempt failed on a connection refusal. Added a readiness wait-loop before re-running, which is what I should have done up front.

**Next:**
- The 4 OpenAI partials are GTM/deployment leadership; the Global Affairs strategy roles (Head of APAC Growth Markets, APAC Strategic Initiatives Lead) scored not a fit, which is the opposite of what I expected. Worth checking whether the profile block or scoring rubric is under-crediting policy/strategy titles relative to GTM ones.

## 2026-05-29 — v3.19.1 — Career location filter tightened + Revolut banner suppressed

Follow-up to v3.19.0 the same day. The first run made it obvious the location gate was too loose (ANZ, Japan, Korea, India roles dominated), so the gate was narrowed to roles that plausibly include Indonesia: Indonesia, Singapore, SEA, and broad APAC / remote-APAC. Revolut, which has no reachable jobs source, stopped showing a standing failure banner.

**Well:**
- Validated the new gate against 24 explicit location cases (kept Singapore / Jakarta / KL / Bangkok / "Singapore; Tokyo" / APAC; dropped Sydney / Tokyo / Seoul / Bengaluru / "South Asia" / US) before touching the database, so the cleanup was a known quantity.
- Confirmed there is no clean Revolut path by probing the four common ATS APIs (Greenhouse, Lever, Ashby, SmartRecruiters) plus Revolut's own endpoints; all either 404 or return a Cloudflare 403. Chose to suppress the banner and keep the source wired rather than rip it out, so it auto-resumes if a path ever opens.
- Cleaned the table deterministically by deleting only the eight out-of-region location strings present, preserving the two in-region Singapore rows, and verified the row count dropped 32 to 2.

**Wrong:**
- The original v3.19.0 gate was looser than the user actually wanted, which only surfaced once real data landed. A short clarifying question on region scope before the first build would have saved the re-run and the cleanup.
- The clarifying question UI returned no recorded selection, so I proceeded on the recommended defaults (exclude East Asia, suppress Revolut banner). They matched the user's stated rule, but worth confirming rather than assuming when the picker comes back empty.

**Next:**
- The default view is now empty until a genuinely senior in-region role opens. A new-fit notification (already on the backlog) would make the twice-weekly scan useful without the user opening an empty page.

## 2026-05-29 — v3.19.0 — Career job watch: twice-weekly role scan with LLM fit scoring

New `/career` page plus a Tue/Thu pipeline that scans Anthropic, Stripe, and Revolut for in-region leadership roles, filters by location and category, and scores survivors against Filman's profile with Sonnet (fit / partial / not_fit + score + summary + rationale).

**Well:**
- Built the source layer behind a small `JobSource` contract with per-source try/catch isolation, so one site failing never blanks the others. Validated this empirically on the first real run: Anthropic (388) and Stripe (62) both succeeded while Revolut failed cleanly on Cloudflare, and the page surfaced the Revolut failure in a banner instead of silently showing fewer roles.
- Proved the cheapest source first. Anthropic's clean Greenhouse API validated the normalize → filter → diff → score → store pipeline before spending effort on the fragile Stripe scrape and the likely-blocked Revolut fetch.
- Filtered hard before the LLM. Location gate plus category hard-excludes cut ~388 Anthropic roles to ~21 candidates, so the expensive scoring only ran on plausible matches, capped at 40 calls per run and guarded by the usage rate-limit check.
- Kept the prompt-injection posture: every job field is sanitized and wrapped with `wrapUntrusted` before reaching the model, since job descriptions are externally-sourced text.

**Wrong:**
- Could not get authenticated browser data onto the page without putting the auth token into the browser context, so I verified the rendered cards by mocking the API response in the page (real-shaped data) and verified the live data separately via a server-side bearer-auth call. The shell and the data are both confirmed, but not in a single authenticated browser view.
- Revolut is wired but currently returns nothing (Cloudflare 403). It ships as a known-failing best-effort source rather than being dropped, which means the page shows a persistent Revolut failure banner until that source is either solved or removed.
- The first end-to-end run scored 32 roles and only 1 came back partial (0 fit), so the default fit + partial view is sparse. That is the filter working as designed (most kept roles are sales-IC that the model correctly rates not_fit), but it means the page looks thin until a genuinely senior in-region role opens.

**Next:**
- Solve or retire Revolut: either find a JSON/XHR endpoint, route through a fetch that survives Cloudflare, or drop the source and remove the standing failure banner.
- The cron-job.org Tue/Thu schedule is a manual UI step the user still needs to add (no workflow file is checked in). Until then the pipeline only runs via the "Check now" button.
- Consider a light notification when a new fit/partial role appears, so the twice-weekly scan does not depend on the user opening the page.

## 2026-05-27 — v3.18.0 — HR Zone Calculator: 4 new experts, median consensus, category grouping

Cardio page HR Zone Calculator gained four named expert rows (San Millán, Lyon, Patrick, Huberman), switched its default consensus rule from "strict floor / highest ceiling" to median across all methods, and grouped bars by category (Formulas / LTHR-based / Experts) with a per-method rationale exposed in the chart tooltip. Coggan Z5 and Friel Z2/Z5 now clamp at maxHR instead of producing inverted ranges when LTHR is high.

**Well:**
- Pulled expert HR ranges from each NotebookLM notebook before touching code; built the 11-method median table and validated against the user's actual numbers (RHR=49, LTHR=169, maxHR=185) before committing. Caught Bare's redundancy with MAF early and dropped him rather than double-counting Maffetone.
- Computed both consensus rules in the component and surfaced them in the same chart so the user can compare without leaving the page. The dashed-line overlay for the inactive rule is low-key enough not to clutter the active band.
- Found and fixed a latent Coggan bug in the same ship: with LTHR=169 / maxHR=185, the Z5 floor was rendering above maxHR (an inverted range). The clamping and degenerate-row filter handle this without special-casing.

**Wrong:**
- Submitted three NotebookLM queries in a single batch but used `find` to locate submit buttons by ref — those refs were stale by the time the click landed, so the questions sat in the input boxes for a beat before I noticed and clicked the visible blue arrows manually. Faster path would have been to find the submit button immediately after each `form_input` and click in the same batch.
- Did not get past the dev-server auth screen, so the UI change is type-checked (`npm run build` clean) but not eyeball-verified pre-merge. Acceptable given the change is component-internal with no API surface, but flagging for future ships that touch authenticated dashboard views.

**Next:**
- Consider adding a "category strip" annotation above the X axis so the Formula / LTHR / Expert groupings are visible without scanning the legend.
- If LTHR/maxHR diverge often (LTHR is ≥91% of max in the current state), consider auto-flagging when the inputs are likely stale and prompting a real max test.

---

## 2026-05-22 — v3.17.2 — Garmin sleep/HR/steps off-by-one date fix

User reported last night's sleep score showed 45 in Garmin but 65 in Supabase. Investigation traced it to date construction: `syncGarmin` passed a midnight-WIB `Date` to `garmin-connect`, whose `toDateString` formats with the server timezone (UTC), rolling the request back a day. Every row was labelled one day ahead of the night it measured. The same `Date` fed steps and resting HR, so those were shifted too; `body_battery_charged` was cross-contaminated from the shifted sleep payload.

**Well:**
- Confirmed root cause empirically (decrypted `raw_json`, compared embedded `calendarDate` per metric) rather than guessing. The 19:00-WIB sync still pulling the prior night ruled out an upload-lag explanation.
- Backfill avoided Garmin entirely: realised each row's five shifted columns are exactly the next day's values, so a single in-place SQL column shift corrected all 57 rows with zero API calls. Re-fetching would have blown the 50/day budget and tripped the circuit breaker, blocking the night's syncs.
- Took a pre-shift snapshot table before mutating prod, and dry-ran the shift (checked date continuity: 0 gaps) before applying.

**Wrong:**
- The codebase already had the correct pattern (`backfillDateRange` used `T00:00:00Z`) right next to the buggy one (`T00:00:00+07:00`). The inconsistency sat unnoticed; a shared helper would have prevented divergence from the start.
- `backfillDateRange` was silently writing `raw_json` unencrypted — a latent security gap found only because the backfill path was being relied on. Caught and fixed in the same ship.

**Next:**
- Historical `raw_json` internals (sleep/heartRate sub-objects) remain one day shifted; only the derived columns were corrected. Low impact (display reads columns), but a future re-fetch could fully realign if needed.
- Decide on morning-freshness improvement (on-demand refresh-if-stale on dashboard load) — see backlog.

---

## 2026-05-09 — v3.17.0 — Cadence calculation fix (Garmin run-only avg)

User flagged Saturday's reported cadence (157 spm) as implausibly low. Investigation found the local code was computing `steps / movingDuration`, which dilutes with walking segments. Garmin's own `averageRunningCadenceInStepsPerMinute` (run-only avg) for the same activity was 163. The weekly briefing then narrated "form breakdown to 157" off a calc artifact.

**Well:**
- The user's instinct was the signal; chasing it found a real, persistent bug that had been silently underreporting cadence on every long run that included a warm-up walk.
- Built a tiny read-only inspection script (`scripts/inspect-activity.ts`) to decrypt and dump a single activity's raw_json. Surfaced the 163 vs 157 discrepancy in one run. Kept it for future debugging.
- Backfill was free: existing `POST /api/running-analysis` with `force_resync:true` re-enriched this week's runs straight into Notion. No one-off script needed.

**Wrong:**
- The original code comment claimed "matches what the Garmin Connect app displays" — that was the opposite of true and probably gave reviewers false confidence at the time it shipped.
- Per-lap cadence isn't fed to Claude in the weekly briefing prompt, only the activity-level average. The model still narrated within-run cadence trajectories ("dropped over the 55-minute Z2 portion") from a single number. That's a hallucination the prompt allowed; not addressed in this ship.

**Next:**
- Add per-lap cadence to the lap line in `analysis-engine.ts` so Claude has real within-run data to reason about, OR tighten the prompt to forbid trajectory claims when only the activity avg is present.
- Audit other Garmin-derived metrics for similar "compute locally vs use Garmin's field" mismatches (stride length, GCT, vertical ratio).

---

## 2026-05-09 — v3.16.0 — Integration self-healing: invalid_grant detection, Reconnect CTA, Notion Tasks hardening

The integrations dashboard had stockpiled five different failure modes (Google invalid_grant on two accounts, Outlook NO_TOKENS, Notion Tasks 500, notion-context 8d stale). Triaged into user-action vs code-fix and shipped the code-fix pass.

**Well:**
- Asked scope up front via AskUserQuestion (re-auth + code, just code, just re-auth) instead of guessing. User picked "both," and the work split cleanly: the user re-auths the OAuth accounts, the code makes the next failure self-explanatory.
- The notion-tasks chunked upsert with per-row retry is a generic improvement: I don't know the exact 500 cause yet, but the next run will log the offending row + Postgres error code, which beats waiting for the user to grep generic error messages.
- Migration was additive (`ADD COLUMN IF NOT EXISTS … DEFAULT false`), so applying it before the code deployed didn't break anything.

**Wrong:**
- Couldn't fully verify the Reconnect CTA locally (no `JARVIS_AUTH_TOKEN` in the worktree's `.env.local`, same gap as the v3.14/v3.15 retros). Build is clean and the page renders, but actual `needs_reauth=true` rendering needs production data.
- The original `[notion-tasks] Upsert error: Internal server error` message turned out to be `safeError`-flattened from a real error, which masked the root cause. Should have made cron error logging less aggressive at the wrapper layer earlier.

**Next:**
- After the next `/api/cron/notion-tasks` run on Railway, paste the `[notion-tasks] Row upsert failed: {…}` log so we can apply a targeted fix (likely a status check-constraint mismatch or a length issue).
- Consider a "Run now" button on the integrations dashboard so manual resyncs don't depend on cron-job.org being healthy. Filed in BACKLOG.
- Local dev `.env.local` for the auth token remains the recurring gap. Worth documenting the minimum env to make `/utilities` exercisable locally.

---

## 2026-05-02 — v3.15.0 — Security pass: error leak fix, prompt sanitize, cookie centralize

A read-only security scan across auth, secrets, prompt injection, XSS/CSRF, input validation, crypto, headers, and SSRF surfaced eight findings. Implemented the cheapest, highest-value subset: A (route raw errors through `safeError`), D (sanitize email source labels in news prompt), G (centralize session cookie attributes).

**Well:**
- Scope discipline. Tackled three small things together instead of trying to fix all eight findings in one ship. Build clean, diff under 80 lines, easy to review.
- Surfaced UX implications before approval. Calling out that `Gmail(work@x.com): invalid_grant` would become `Gmail(work@x.com): reconnect required` let the user weigh signal loss against leak risk before the change shipped.
- Centralized cookie opts as a constant with a CLAUDE.md note. Future auth cookie writes can't drift.

**Wrong:**
- Couldn't smoke-test login/logout end-to-end because the local dev preview lacks `JARVIS_AUTH_TOKEN`. Same gap noted in the v3.14 retro. Build catches type errors, not behavioral regressions on auth-gated routes.

**Next:**
- Five findings remain from the scan: rate limiter coverage on expensive endpoints (B), zod schemas + body caps on weight/contacts/kpis (C), session expiration tightening (E), Origin/Referer check in middleware (F), login brute-force backoff. B + C are next on the list when there's budget.

---

## 2026-04-29 — v3.14.0 — Schedule strip: highlight currently-active event

The "Today's Schedule" card's blue overlay was a title-based heuristic — anything titled "deep work" or "focus" got the accent. Replaced with a time-based check (`start_time <= now < end_time`) so the highlight follows the clock.

**Well:**
- Asked two clarifying questions before editing instead of guessing: (1) replace deep-work styling vs. layer both, (2) add a 1-min ticker or accept the 5-min polling lag. Saved a likely-wrong second pass. User picked replace + no ticker, exactly the simpler path.
- Investigated before assuming. The screenshot's "Focus" highlight looked like an active-event indicator, but a single read of `ScheduleStrip.tsx` showed it was actually `title.toLowerCase().includes('focus')`. Naming the actual logic up front prevented a "make the highlight follow the clock" change that would have layered on top of a hidden heuristic instead of replacing it.
- Surgical diff. Single component, ~10 lines net. No timezone math needed since both sides of the comparison are absolute UTC milliseconds — `Date.now()` and `new Date(iso).getTime()` are directly comparable.

**Wrong:**
- Couldn't visually verify the highlight on the live dashboard — it's auth-gated and the dev preview only reaches the auth screen. Fell back to the production build for type validation, which catches compile errors but not the actual visual outcome. Acceptable for a one-component CSS-class swap, but worth noting that any non-trivial dashboard UI change has this verification gap.

**Next:**
- The `usePolling` 5-min cadence means the highlight can lag up to 5 min when an event ends. If that lag becomes annoying in practice, add a 1-min `setInterval` ticker in `ScheduleStrip` that just bumps a state variable to force re-evaluation of `isActive` — no extra network calls.

---

## 2026-04-28 — v3.13.0 — Disable Jarvis email drafting

Filman flagged that the auto-drafted email replies weren't useful and didn't have a fix in mind for their quality, so the feature is now disabled to stop burning Claude tokens. Triage classification stays on so the "Needs response" dashboard card keeps working — only the draft-generation step (Step 4) and the Outlook draft push (Step 5) are short-circuited inside `triageWorkEmails()`.

**Well:**
- Investigated before editing. The first exploration agent flagged `/api/emails/synthesize` as a "kill candidate" but the route name was misleading — it's the daily butler-voiceover summary, not draft generation. Verified by reading the route and pulling out the right surgery line. Saved a near-miss kill.
- Picked the lightest viable change. The user said they didn't have an idea to fix drafts yet, which means re-enabling later is plausible. Short-circuited at the orchestrator level with a one-line comment that says how to revert, instead of deleting helper functions, schema, or routes. Net diff was +20/-23 lines across three files.
- Caught the version-bump ambiguity. Initial change used `/ship-stream` rules (patch bump → 3.12.1) but the user invoked `/ship` (minor bump → 3.13.0). Fixed both `package.json` and the inline code comment before committing.

**Wrong:**
- The first turn of the session returned "No response requested" instead of acting on the user's request. They had to ask "where are we?" to get me unstuck. The kickoff message had a literal "DON" cut off mid-word — should have inferred the intent and asked one clarifying question instead of treating it as a no-op.

**Next:**
- The `email_draft_blocklist` table and `email_triage.draft_*` columns are now dormant data. If Filman doesn't re-enable drafting within ~3 months, schedule a Phase C cleanup (drop table + columns + archive the Notion `ghostwriting` page).
- The `ghostwriting` Notion context page is no longer fetched by any code path. Worth archiving or repurposing once we're confident drafting stays off.

---

## 2026-04-25 — v3.10.6 — Persist measured max HR + close two stale backlog items

Picked up the only High-priority backlog item that wasn't already shipped: surface a UI nudge to enter a tested max HR and persist it once entered. Two adjacent High-priority entries were closed as already-solved during this work — the walk-filter VO2 false-positive (v3.10.3 HR tiebreaker) and the "preview weekly analysis" button (the existing "Run Analysis" button on /cardio-analysis already does this).

**Well:**
- Reused the existing `health_measurements` pipeline rather than introducing a new column or table. Adding `max_hr` to `VALID_TYPES` was a 2-line change; the rest fell out of the existing pattern. No migration needed at all.
- Reading the page source first surfaced two backlog items that were already done. Net delivered work was one feature, but three High-priority backlog entries closed.
- Verified end-to-end in the browser preview: badge flipped from amber `formula` to green `measured` after commit, value persisted across reload, and the nudge banner conditionally rendered correctly. Tested the actual HTTP path (POST /api/health/measurements → GET /api/cardio/hr-zones returns measured) directly when a synthetic-event React-controlled-input quirk made the UI test inconclusive.
- Cleaned up the test row (max_hr=188) from prod after verification so Filman starts from a clean slate when he enters his real value.

**Wrong:**
- The first preview server attempt failed because the worktree was missing `.env.local` — known CLAUDE.md gotcha #2. Copied from the parent repo. Worth investing 15 minutes in a `bin/sync-worktree-env.sh` symlink helper at some point so this doesn't repeat.

**Next:**
- Preview-server auto-login flag (NEXT_PUBLIC_DEV_AUTO_LOGIN) is on the backlog as a Medium-priority follow-up; would have saved a step in this session too.
- High-priority section of the backlog is now empty. Next session should pull from Medium tier or surface new items.

---

## 2026-04-25 — v3.10.5 — RLS hardening sweep (drop permissive policies on 28 tables)

Closed an anon-key exposure across 28 `public` tables. Each carried a `FOR ALL USING (true)` policy that gave anon/publishable-key holders full read+write — including on highly sensitive tables like `google_tokens`, `microsoft_tokens`, `garmin_tokens`. The app uses service-role server-side and bypasses RLS regardless, so app behavior is unchanged.

**Well:**
- Pulled the actual policy names from `pg_policy` rather than guessing — 28 tables had four different policy-name conventions across the migration history (`Allow all`, `Allow all for authenticated`, `Allow all for service role`, `service role full access`, plus per-table `<table>_all`). A guess-based migration would have left several policies in place.
- Re-ran the security advisor immediately after applying. The permissive WARNs collapsed to INFO-level `rls_enabled_no_policy` entries (the desired posture). Confirmed the change at the lint level, not just the SQL level.
- The backlog estimated ~25 tables; the real number was 28. Querying first instead of trusting the estimate caught three tables that would otherwise have been missed.

**Wrong:**
- Nothing material. The CI guard script (a follow-up that fails on ERROR-level lints) was kept out of scope per the plan; it was easy to feel completionist about it but it's a separate ship.

**Next:**
- CI guard for advisor lints — its own ship, low priority.
- This sweep didn't add any anon-key policies. If a future flow needs anon-key access (e.g. a public-facing form), a per-table `INSERT WITH CHECK` policy is the right shape — not another `FOR ALL USING (true)`.

---

## 2026-04-25 — v3.10.4 — Normalize legacy health_measurements rows

Cleared two-row drift in `health_measurements` from before the POST endpoint's `VALID_TYPES` was renamed (`dead_hang` → `dead_hang_seconds`, `ohs_major_compensations` → `overhead_squat_compensations`). Pruned the corresponding shim entries from the OKR canonicalization layer.

**Well:**
- Verified the unique-constraint shape (`UNIQUE (date, measurement_type, source)`) and the actual row dates before writing the migration. The legacy rows happened to share dates only with each other, so the rename was collision-free — but the check is what made that knowable up front rather than at apply time.
- Caught the over-broad scope. The original backlog read suggested migrating ALL five entries in `MEASUREMENT_TYPE_CANONICAL`, but reading the POST route's `VALID_TYPES` revealed three of them are the canonical DB names (the OKR keys are short forms by design). Renaming those would have broken `VALID_TYPES`, `DEFAULT_UNITS`, `health-fitness/insights`, and `/trends`. Trimmed scope to the two genuine drift entries.

**Wrong:**
- Nothing material. One small thing: the original shim's comment said "legacy aliases" for all 5 entries, which is what made the backlog item over-scope itself in the first place. Comment is now rewritten.

**Next:**
- Item #6 (RLS hardening sweep) is the next high-priority DB hygiene ship — same session.

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

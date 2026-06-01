# Backlog

Future features, pickup notes, and scope-later items. Mirrors the Notion Product backlog page. Grouped by priority tier; newest-first within each tier.

---

## High priority

### 2026-05-31 — Security hardening wave: OAuth, Garmin secrets, dependencies

**Context:** Security review on 2026-05-31 covered auth, OAuth, secrets, Supabase/RLS, prompt-injection surfaces, input validation, storage/media URLs, dependency audit, n8n workflow artifacts, and the existing backlog. The app already has several strong defenses: timing-safe auth comparisons, signed OAuth state cookies, server-only service-role Supabase access, tightened RLS policies, centralized session cookie attributes, and escaped markdown rendering before `dangerouslySetInnerHTML`.

**Status (2026-06-01):** First P0 batch shipped in v3.22.0 (commit `6dbecb78a6eb129721135d17ae5035104b883822`): OAuth start routes are auth-gated, Garmin local scripts now require service-role encrypted writes, and dependency audit findings are patched. Prompt-injection defense standardization shipped in v3.22.1. Remaining security work now starts with the older B/C findings: rate limits plus request validation/body caps.

**Highest-priority batch:**
- **DONE in v3.22.0 — Protect OAuth connect start routes:** wrap `/api/auth/google` and `/api/auth/microsoft` in browser auth, or bind OAuth state to an existing Jarvis session. Today the callback is state-protected, but the connect flow itself can be initiated by anyone.
- **DONE in v3.22.0 — Clean up Garmin secret handling in local scripts:** update `scripts/seed-garmin-tokens.mjs` and `scripts/backfill-recent.mjs` so they require `SUPABASE_SERVICE_ROLE_KEY`, write encrypted tokens to `garmin_tokens`, never fall back to the publishable/anon key, and encrypt Garmin `raw_json` with `wrapJsonb` when writing daily rows.
- **DONE in v3.22.0 — Patch dependency vulnerabilities:** `npm audit --audit-level=high` currently reports 7 vulnerabilities: high severity in `next`, `axios`, and `lodash`; moderate in `follow-redirects`, `postcss`, `qs`, and `ws`. `next` is pinned to `16.1.6`; `garmin-connect` brings several vulnerable transitives. Upgrade or override, then rerun audit + build.
- **DONE in v3.22.1 — Standardize prompt-injection defenses:** apply `sanitizeInline` / `sanitizeMultiline` + `wrapUntrusted` to remaining Claude prompts that embed email/calendar/task data directly: `/api/emails/synthesize`, `/api/emails/style-analysis`, and `/api/briefing/delta`.

**Second batch / fold-ins from existing backlog:**
- Roll in the 2026-05-02 security leftovers: rate limits for `/api/sync/emails`, `/api/briefing/*`, `/api/contacts/scan`, and `/api/cron/*`; zod schemas + body-size caps for remaining POST handlers; session hardening; Origin/Referer checks; login backoff.
- Replace the browser session cookie value with a signed session token instead of storing the root `JARVIS_AUTH_TOKEN`; reduce TTL or add revocation if a session table is introduced.
- Move state-changing browser GET routes like `/api/sync/garmin/run` and `/api/running-analysis/run` to POST.
- Tighten authenticated/private audio caching, store Supabase Storage object paths instead of persisted signed URLs for delta audio, and mint signed URLs on read.
- Remove embedded Supabase keys from `n8n-workflows/*.json`; keep keys in n8n credentials or route workflows through Jarvis cron endpoints with scoped cron auth. Also reconcile the README, which still mentions service-role setup, with the current RLS-no-policy posture.

**Existing backlog security opportunities checked:** the 2026-05-02 security item remains the main prior security backlog entry; attachment-aware email triage also requires a separate security review before implementation because it would introduce attachment parsing and phishing/malware exposure.

**Trigger:** OAuth/Garmin/dependency and prompt-hardening batches are shipped. Next security ship should pick up the older B/C findings and the remaining second-batch items.

---

## Medium priority

### 2026-05-30 – Investments price source: Yahoo blocked, needs keyed provider

**Context:** v3.21.0 shipped the `/investments` page. Prices come from the `investment_quotes` table, refreshed by `/api/cron/investment-quotes`. The cron job is now set up; the data source is not working.

**Status (2026-05-31):**
- Cron schedule: DONE. cron-job.org job "Investment Quotes Refresh" (id 7705843), Asia/Jakarta, fires daily at 12:30, 16:30, 04:30 WIB (IDX/SGX mid-day, IDX/SGX close, US close). Sends `x-cron-secret` (reuses the existing jobs' secret). Enabled, `saveResponses` on.
- Yahoo confirmed BLOCKED: HTTP 429 from both the dev IP and the Railway production IP. A manual seed run returned `{fetched:47, priced:0}`. This is IP-based rate-limiting, so the cron stores zero prices on every run. The page degrades gracefully (no price/verdict shown, never crashes).
- Stooq (keyless) tested as an alternative: covers US only (AAPL.US returns data); IDX (BBCA.JK) and SGX (D05.SI) return no data. Not viable as sole source.
- Decision (2026-05-31): leave as-is for now. Page shows valuation ranges only, prices blank, until a working source is wired.

**Next when revisited:** wire Twelve Data as the primary quote source (free tier 800 req/day covers IDX/SGX/US; our load is ~141/day). Needs a free account + API key behind an env var, plus a symbol-format mapping (Yahoo `BBCA.JK`/`D05.SI`/`AAPL` to Twelve Data symbol + exchange). Verify with a manual cron trigger after wiring.

### 2026-05-29 — Career job watch follow-ups: Revolut source, scheduling, new-role notification

**Context:** v3.19.0 shipped the `/career` page and the Tue/Thu scan across Anthropic, Stripe, and Revolut. Three follow-ups surfaced.

**Scope:**
- Revolut source is wired but blocked by Cloudflare (HTTP 403), so it returns nothing. As of v3.19.1 its failure banner is suppressed (treated as a best-effort source, stays wired so it auto-resumes if a path opens), but it still yields zero roles. Probed Greenhouse, Lever, Ashby, SmartRecruiters, and Revolut's own endpoints in v3.19.1: no clean public jobs API exists and every Revolut route returns a Cloudflare 403. To get Revolut data, find a working JSON/XHR endpoint or route the fetch through something that survives the bot check. Stripe is a server-rendered HTML scrape and is similarly fragile; it throws on zero rows so a markup change shows up as a source failure rather than a silent empty list.
- Scheduling (DONE 2026-05-30): cron-job.org job "Jarvis Career Job Watch" (jobId 7701249) runs Monday and Wednesday at 19:00 WIB — evening, well clear of the 07:30 briefing. GET to the deployed `/api/cron/career-jobs` with the `x-cron-secret` header, 19:00 in the Asia/Jakarta timezone (wdays Mon+Wed). Created via the cron-job.org API and verified enabled. Caveat: cron-job.org's free-plan request timeout is 30s, so a heavy backfill run can log a timeout on their side even though the scan completes server-side and our own cron log records success; steady-state runs (scoring only new/changed roles) are well under that.
- New-role notification: the twice-weekly scan only helps if the user opens the page. Consider a light alert (briefing line, push, or email) when a new fit or partial role appears.
- Scoring rubric check (surfaced when OpenAI was added in v3.19.2): the 4 OpenAI partials are all GTM/deployment leadership, while the Global Affairs strategy roles (Head of APAC Growth Markets, APAC Strategic Initiatives Lead) scored not a fit. That is the opposite of the expected weighting given Filman's strategy/consulting background. Worth checking whether the profile block or scoring instructions under-credit policy/strategy titles relative to GTM ones, or whether those specific JDs genuinely sat below the bar. (Note: on the v3.19.3 rescan, Head of APAC Growth Markets flipped to fit/85, so some of this is model run-to-run variance.)
- Career budget/scheduling (surfaced in v3.19.3, decided 2026-05-30): scoring shares the 50/day Claude budget and is capped at 40/run. Resolved by scheduling the cron for Monday and Wednesday at 19:00 WIB (evening), well clear of the 07:30 briefing, so even a rare 40-call burst cannot starve the morning brief; per-run cap left at 40. Note: manual scans while building (May 29-30) pushed daily usage to 63-64 and tripped the limit for Email Synthesis — a one-time backfill artifact, not steady-state (a typical scan scores only new/changed roles, ~0-5 calls).
- Grab JD enrichment: Grab's SmartRecruiters list endpoint carries no job description, so those roles score on title plus department only. A per-kept-role detail fetch would lift scoring confidence without pulling all 348 descriptions.
- GoTo sub-brands: the gotocompany.com API exposes HoldCo (group corporate) roles only. Gojek, GoPay, and Tokopedia run on separate career sites. GoPay/fintech is highly relevant to Filman, so wiring those in is worth a look if HoldCo volume stays thin.
- Career filter polish (from v3.20.0): (a) optionally sort Jakarta-based roles above Singapore within each company group, since Jakarta is Filman's preferred base; (b) cross-filter facet counts so each facet's numbers reflect the other active selections (today counts are computed over the closed-filtered set only, so a count can read higher than a combined selection shows); (c) the work-type taxonomy is a hand-maintained keyword map in page.tsx, revisit if a new source classifies too many titles as Other.

**Trigger:** Revolut/Stripe when a scan silently drops a source or the banner becomes noise; scheduling immediately (one-time setup); notification if the page is not being checked regularly.

---

### 2026-05-22 — Morning-freshness for Garmin data + raw_json realign

**Context:** v3.17.2 fixed the date off-by-one so the 07:00-WIB sync now captures last night's sleep correctly, and the 07:30 briefing reads it. Two follow-ups surfaced.

**Scope:**
- Morning freshness: Garmin keeps refining the sleep score for ~1-2h after wake, so the 07:00 capture can be slightly preliminary (the 13:00 sync finalises it). If the user wants the latest possible number at review time, add a refresh-if-stale on dashboard load (trigger a single `syncGarmin` when `garmin_daily` for today is older than N minutes), respecting the 50/day budget and circuit breaker. Alternative: a manual "refresh" button on the Fitness card.
- `raw_json` realign: the in-place column shift corrected the derived columns but left historical `raw_json.sleep` / `raw_json.heartRate` sub-objects one day shifted. Only surfaces via the latest-day sleep qualifier in `health-fitness/route.ts` (self-heals daily) and debug reads. A bounded re-fetch could realign history if it ever matters.

**Trigger:** If morning review consistently shows a preliminary score, or before any feature that reads historical `raw_json` sleep internals.

---

### 2026-05-09 — Per-lap cadence + audit Garmin-derived metrics

**Context:** v3.17.0 fixed activity-level cadence (use Garmin's run-only average instead of locally diluted compute). Two follow-ups surfaced during the fix.

**Scope:**
- Add `cadence` to the per-lap line in `src/lib/running-analysis/analysis-engine.ts` (line ~241). Today the lap line is `dist/dur/pace/HR` only, so when Claude narrates "cadence dropped over the run" it is hallucinating a trajectory from a single average. With per-lap cadence, the model can either cite real lap drift or correctly say there is none.
- Audit other Garmin-derived metrics in `src/lib/running-analysis/index.ts` for the same "compute locally vs use Garmin's field" mismatch. Suspects: stride length, ground contact time, vertical ratio. Compare against what Garmin Connect app surfaces for the same activity.

**Trigger:** Next time we touch the running-analysis pipeline, or sooner if the briefing keeps producing dubious within-run dynamics claims.

---

### 2026-05-09 — Integrations: "Run now" button + targeted Notion Tasks fix

**Context:** v3.16.0 added Reconnect CTAs and chunked Notion Tasks upserts, but two follow-ups remain.

**Scope:**
- Add `POST /api/utilities/run-sync` (auth: `withAuth`) that takes a `sync_type` and invokes the matching cron handler in-process. Wire one button per integration card on `/utilities`. Removes dependency on cron-job.org for ad-hoc resyncs (notion-context staleness was the proximate cause).
- After the next Railway run, capture the `[notion-tasks] Row upsert failed: {row, error}` log and apply a precise fix in `src/lib/sync/notionTasks.ts` (likely status check-constraint or length).
- Document the minimum local `.env.local` so the integrations dashboard is exercisable in `npm run dev`.

**Trigger:** Pick up after the user pastes the Notion Tasks log line.

### 2026-05-02 — Security: remaining findings from v3.15.0 scan

**Context:** Full security scan in v3.15.0 surfaced eight findings; only A + D + G shipped. Five remain.

**Status (2026-05-31):** Still valid. Fold these into the 2026-05-31 high-priority security hardening wave above so the next security ship can cover old and new findings together.

**Scope:**
- **B (rate limits):** add limiter coverage to `/api/sync/emails`, `/api/briefing/*`, `/api/contacts/scan`, `/api/cron/*`. The cron endpoints are constant-time-secret-checked but allow unlimited guesses.
- **C (input validation):** add zod schemas + body-size caps to POST handlers in `src/app/api/health/weight/route.ts`, `src/app/api/contacts/store/route.ts`, `src/app/api/kpis/route.ts`. The `contacts` array is currently unbounded.
- **E (session hardening):** tighten 7-day session to 24h, optionally add a server-side session table for revocation on logout. Currently logout clears the cookie but the token would still be valid if leaked.
- **F (CSRF defense in depth):** add Origin/Referer check in `src/middleware.ts` for state-changing methods. SameSite=strict already mitigates, this is belt-and-suspenders.
- **Login brute-force:** per-IP exponential backoff on `/api/auth/login` beyond the existing 5/min cap. Token entropy is high so this is low priority.

**Trigger:** Pick up B + C as the next batch when there's appetite for another security ship.

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

# Changelog

All notable changes to Jarvis are documented here.

Format: `{major}.{minor}` — from v3.0 onward we version by minor only (3.0, 3.1, 3.2…), not by patch.

## [3.33] – 2026-06-20 – News blocklist expansion from the first weekly review (v3.33.0)

First weekly scheduled review (7-day window) of outlets pulled into the Current Events feed, confirmed by Filman before applying. Added 46 outlets to `BLOCKED_OUTLETS` in `src/lib/sources/googleNewsRss.ts` (20 International, 26 Indonesia). The filter stayed healthy: most recurring junk was already caught by the v3.32 batch, so this pass is mostly the previously-deferred Tier-3 long tail.

- International (20): gadget-review and rumor blogs (9to5mac, 9to5google, macrumors, gsmarena.com, bgr.com, notebookcheck, wccftech), sports (sports illustrated, mma fighting, ufc.com, covers.com), entertainment/lifestyle/fashion (e! news, wwd, marthastewart.com, yourtango, time out worldwide, today.com, eater los angeles, hollywoodreporter.com), and government PR (texas department of public safety).
- Indonesia (26): lifestyle/entertainment verticals (detiktravel, wowkeren, sindonews lifestyle, the lazy media), vendor/gadget (xiaomi-miui), government/institutional PR (presiden ri, bmkg, badan riset dan inovasi nasional), religious/community org outlets (nu online, suara muhammadiyah, sh terate madiun), hyper-local regionals (batamnews, sumeks, bantendaily, kilasjatim.com, radar bontang, mnc trijaya kendari, beritajatim.com), and low-credibility/niche portals (carapandang, langitselatan, artik.id, tebaran.com, atnews.id, merahputih.com, realestat.id, ajaib).
- Matcher-safety forms used to avoid false positives under the includes() rule: today.com (not today, which would match "USA Today"), sindonews lifestyle (not sindonews, which would match the kept .com / nasional / ekbis verticals), badan riset dan inovasi nasional (not bare brin), and domain forms covers.com / hollywoodreporter.com. The latter also closes a real gap: hollywoodreporter.com slipped past the spaced hollywood reporter entry.
- Deliberately kept per Filman's call: harapan rakyat (the highest-frequency ID candidate, wanted for coverage), plus inilah.com, viva.co.id, and suara.com. Still excluded pending a word-boundary matcher: ign (bare substring would match "Foreign Policy").
- Note: ajaib was kept as finance-relevant in v3.32 but is now blocked per this review's Tier-3 selection (it is investing-app content marketing, not journalism).

## [3.32] – 2026-06-20 – News outlet blocklist expansion from a 14-day source audit (v3.32.0)

Audited every outlet pulled into the Current Events feed over 14 days (41 slots, both Indonesia and International tabs) and expanded `BLOCKED_OUTLETS` in `src/lib/sources/googleNewsRss.ts` to drop non-current-events noise. The filter itself was confirmed healthy (already-blocked outlets stopped appearing after the Jun 7-8 additions); this is a curation pass, not a bug fix.

- Added ~48 outlets across both locales: sports (espn, yahoo sports, cbs sports, bleacher report, opta analyst, juara.net), entertainment and lifestyle (variety, entertainment weekly, billboard, page six, the cut, instyle.com, wolipop), gaming and gadget-review (gamesindustry.biz, gamebrott.com, telset.id), automotive and food verticals (detikoto, detikfood, otoplus-online, ridertua.com), vendor and corporate PR (apple, samsung, mayapada hospital), government and institutional PR (direktorat jenderal pemasyarakatan, pemerintah provinsi gorontalo, infopublik, four university sites), a UGC blog farm (kompasiana.com, kept distinct from the legit kompas.com), and recurring hyper-local outlets (US TV affiliates abc7 los angeles / abc7 new york / nbc los angeles, plus Indonesian regionals sumbawanews, kabar6.com, rakyatpos.id, baubaupost, radar karawang, antara news sulteng, gentra news, jurnal borneo, telstar1027fm.com, tandaseru.id, media alkhairaat, news.schoolmedia.id).
- Fixed a real gap: `pontianakpost` (no-space, seen 5x) was slipping past the existing `'pontianak post'` entry because the substring matcher cannot bridge the missing space. Added the no-space variant.
- Deliberately excluded: finance content (stockbit snips, ajaib) and fact-checkers (turnbackhoax, jala hoaks) since they are relevant; Tier-3 borderline outlets (detik tech vertical, Apple/gadget-rumor blogs, US regional papers) pending review; and `ign`, which is left out because a bare substring would wrongly match outlets like "Foreign Policy" — it needs a word-boundary matcher first.
- A weekly scheduled review (Sunday morning WIB, run from the Claude app, not in-app code) now re-runs this audit over the previous 7 days of pulled sources and proposes new blocklist candidates for confirmation; it never auto-edits the list.

## [3.31] – 2026-06-20 – Fix retired Sonnet model id; centralize + tune model selection (v3.31.0)

Claude Sonnet 4 (`claude-sonnet-4-20250514`) retired on 2026-06-15, so every Claude call still hardcoding that id returned `404 not_found_error`. This broke the morning briefing, email triage, and email synthesis (visible as red on the Utilities page), with briefing delta/regenerate, on-demand email synthesize, email style-analysis, fitness insights, voice intent, and running-analysis latently broken too. Root cause: the model id was a string literal copy-pasted across ~14 call sites.

- New `src/lib/models.ts` exports a single `CLAUDE_MODEL` constant (now `claude-sonnet-4-6`, the active Sonnet and documented drop-in for the retired one). All 14 call sites import it instead of hardcoding an id, so the next model migration is a one-line change.
- Restores the 11 broken/latent call sites and unifies the 3 that were on the `claude-sonnet-4-5` alias (news synthesis, career-jobs, and the Ubayy-driven Quran synthesis) onto the same constant.
- Pure id swap: verified no call site uses assistant-turn prefills, `budget_tokens`, `output_format`, or `top_p`/`top_k` (all of which 4.6 rejects), so no other request changes were needed.
- Tuned model and effort per task instead of running everything at Sonnet 4.6's implicit `high` default. Added a `CLAUDE_MODEL_FAST` tier (`claude-haiku-4-5`) for latency-sensitive and bulk-classification work: voice intent parsing, email-triage classification, and job scoring now run on Haiku. The Sonnet calls set `output_config.effort` explicitly: `low` for frequent digests and deltas (email synthesis, news synthesis, briefing delta, fitness insights), `medium` for the daily briefing and email reply drafting, `high` for the weekly running analysis and the rare email style analysis. Quran synthesis is Ubayy-owned, so it stays on the default Sonnet model with no effort change (the Haiku/effort note is flagged to Ubayy).

## [3.30] – 2026-06-19 – Quran synthesis: harden the length cap (v3.30.0)

Tightened the `POST /api/quran/synthesis` prompt so the note holds the five-minute length on long or dense portions. Originates from Ubayy (the Quran reader that piggybacks on Jarvis's Anthropic API); shipped from a Claude worktree.

- `src/app/api/quran/synthesis/route.ts`: the length rule changes from a "firm limit" to a "hard cap" of about 1000 words, never above 1100, explicitly even for long or dense portions, with selectivity over exhaustiveness called out as the priority.
- The Meaning guidance is reworded to match: it now tells the model to be selective rather than exhaustive on a long or dense portion so the whole piece stays within the cap, and drops the "give it the most room" framing that pulled it toward overruns.
- Four-section shape (Overview, Historical context, Meaning, Sources) and per-section budgets are unchanged. Prompt-only; no schema or signature change. Cached notes need a regenerate to adopt the tighter cap.

## [3.29] – 2026-06-19 – Quran synthesis: four-section deep-dive structure (v3.29.0)

Restructured the `POST /api/quran/synthesis` output from six sections to four, shifting weight onto the explanation. Originates from Ubayy (the Quran reader that piggybacks on Jarvis's Anthropic API); shipped from a Claude worktree.

- `src/app/api/quran/synthesis/route.ts`: the standalone Key terms and Cross-references sections are removed. The note is now Overview, Historical context, Meaning, Sources. Arabic terms and cross-references are woven into the Meaning walk-through instead of listed separately.
- Meaning is now the heart of the piece: its budget rises from ~450 to ~700 words and it is told to go deep on each thematic cluster (what it means, why it matters, how the mufassirun read it). Historical context nudged ~150 to ~170. Overall cap stays ~1000-1100 words; the "complete every section, never stop mid-sentence or drop Sources" rule now covers four sections.
- Prompt-only; no schema or signature change. Note for consumers: the rendered output no longer contains Key terms or Cross-references headings. Cached notes need a regenerate to adopt the new structure.

## [3.28] – 2026-06-19 – Quran synthesis: longer five-minute read (v3.28.0)

### Quran synthesis: per-section word budgets (v3.28.1)

Refined the length rule in the `POST /api/quran/synthesis` prompt. Instead of one flat 1000-1100 word cap, the model now gets rough per-section word budgets (Overview ~80, Historical context ~150, Meaning ~450 with verse clustering, Key terms ~120, Cross-references ~100, Sources a short list) so the piece reliably fits the five-minute target and always completes all six sections. Prompt-only, no schema or signature change.

Tuned the `POST /api/quran/synthesis` prompt so the generated note is a fuller five-minute read instead of a short summary.

- `src/app/api/quran/synthesis/route.ts`: target length raised from 700-800 to 1000-1100 words; the Meaning section now groups verses into a few thematic clusters rather than a strict verse-by-verse walk, to keep the longer piece tight; a firm length rule was added telling the model to complete all six sections (never stop mid-sentence or drop Sources) over going deep.
- `max_tokens` raised 2200 → 4096 so the longer output is not truncated.
- Prompt-only change; no schema or signature change. The `(user, date)` cache means a regenerate is needed to refresh any note already cached for a given day.

## [3.27] – 2026-06-19 – Quran: on-demand daily reading synthesis endpoint (v3.27.0)

New `POST /api/quran/synthesis` route generates the daily Sunni-tafsir reading synthesis for the Ubayy reader on demand and caches it per `(user, date)`, so the briefing and the 15:30 callback reuse one generated text instead of regenerating.

- `src/app/api/quran/synthesis/route.ts`: `withAuth`-protected, rate-limited via `checkRateLimit`. Validates the request body with zod (date, surah 1-114, range, 1-60 ayahs each capped at 4k chars). Returns the cached row unless `regenerate: true` is passed; otherwise calls Claude (Sonnet), upserts on `user_id,date`, and best-effort logs usage. Errors route through `safeError`.
- Prompt asks for a 700-800 word synthesis grounded in Ibn Kathir, Maarif-ul-Quran, Tafsir Al-Azhar, and al-Tabari, with fixed markdown headings (Overview / Historical context / Meaning / Key terms / Cross-references / Sources) and no em-dashes.
- Migration `033`: idempotent backfill of `quran_synthesis` (the table was created directly in prod; this file restores repo/schema sync). RLS enabled, service-role only.
- Authored by the Ubayy system (a separate Quran reader that piggybacks on Jarvis's Anthropic API); shipped from a Claude worktree. No caller wired up yet, so the endpoint is reachable but not yet invoked by the briefing or cron (flagged to backlog).

## [3.26] – 2026-06-08 – News: blacklist six non-current-events outlets (v3.26.0)

Six outlets added to the `BLOCKED_OUTLETS` list in `src/lib/sources/googleNewsRss.ts` so they no longer surface in the Indonesia/International news synthesis or count toward outletScore corroboration.

- International (WORLD): `tmz` (celebrity gossip), `chapelboro` (hyper-local Chapel Hill NC), `dawgnation` (Georgia Bulldogs fan site).
- Indonesia (ID): `pdiperjuanganbali` (PDI-P Bali political party site, not journalism), `gerbang indonesia` / `gerbangindonesia` (low-credibility partisan site), `gamereactor` (gaming news).
- ESPN and detikInet were considered but kept at the user's request.
- Matching is case-insensitive substring against the normalised outlet name, applied both to an item's primary source (item dropped) and its related outlets (scrubbed, no longer counts toward outletScore).

## [3.25] – 2026-06-08 – Investments: market cap + last-FY net income columns, sorted by market cap (v3.25.0)

The `/investments` table gains two columns and a new sort: each industry group is now ordered by market cap, largest on top.

- `src/app/investments/page.tsx`: added Market cap and Net income (last FY) columns with a compact T/B/M money formatter; each group is sorted by market cap descending (names without a market cap sort to the bottom); both also surface in the detail view.
- `src/lib/investments/sheetQuotes.ts`, `sgxQuotes.ts`, `quotes.ts`: the quote types carry `marketCap` and `netIncome`; the sheet reader parses two new CSV columns.
- `src/lib/sync/investmentQuotes.ts`: stores and reads `market_cap` and `last_fy_net_income`, preserving prior values across a blank fetch (same pattern as the 7d/30d history). For SGX, price comes from the live feed while market cap and net income come from manual sheet rows.
- Migration `032`: adds nullable `market_cap` and `last_fy_net_income` to `investment_quotes` (applied to prod).
- Source sheet: market cap via GOOGLEFINANCE marketcap (US + IDX) plus a manual snapshot for the three SGX banks; net income is a manual last-FY figure per name (mostly FY2025), researched and filled. Verified end to end: the cron priced 51/51 and the new columns populated in Supabase.
- Caveat: GOOGLEFINANCE's IDX market caps derive from its own price feed (which runs lower than headline figures), so absolute IDX market caps are understated and within-IDX ordering reflects that feed, not exchange-reported market cap.

## [3.24] – 2026-06-08 – Investments: five new IDX watchlist names (v3.24.0)

Five Indonesian names added to the `/investments` watchlist universe and mirrored on the Notion Investment page (Month 4 IDX Tier 1 table).

- `src/data/watchlist.ts`: ASII (Astra International) joins BIRD under Transport & infrastructure; BNLI (Bank Permata) added under Banks; EXCL (XLSmart Telecom Sejahtera, formerly XL Axiata) added under Telecom; the Super-app & fintech group was renamed Tech and now holds GOTO plus DCII (DCI Indonesia); a new Retail group holds AMRT (Sumber Alfaria Trijaya, Alfamart).
- Prices: rows for the five names added to the published "Jarvis Investment Quotes" sheet (GOOGLEFINANCE), so the quotes cron prices them.
- Valuations pending: no DCF entries yet for these five, so fair value and verdict show a dash until a valuation is published. Flagged to backlog.
- ASII and AMRT sit partly outside the page's stated circle of competence (heavy industrials, mining, palm oil for ASII; consumer staples for AMRT); included at the user's request with a note on the Notion page.

## [3.23] – 2026-06-08 – Investments: valuation-aware watchlist (v3.23.0)

Release marker consolidating the investments work that landed across the 3.22.3 to 3.22.10 patch window into one minor version. The Investments page is now a working valuation-aware watchlist. No new code in this marker beyond the version bump; the detail for each item lives in the v3.22.x subsections below.

- Manual Refresh button so a newly published Notion valuation appears on demand instead of on the next day or a redeploy (v3.22.3).
- Multi-period price changes (1D, 7D, 30D) and an explicit fair value next to the range and as-of date; ISAT added, ASSA and JSMR dropped; 7D and 30D sourced from new GOOGLEFINANCE history columns, with parser, quoting, and cache-bust fixes found by firing against live data (v3.22.4 to v3.22.7).
- Quote refresh preserves prior 7D and 30D values across a momentary blank fetch, so a mistimed snapshot no longer wipes the columns (v3.22.9).
- Live gap from the last price to fair value beside each verdict, replacing the stored upside that was frozen at valuation time (v3.22.10).
- Alongside this arc, a stage-by-stage equity DCF of Bank Rakyat Indonesia was added to the valuation library.

## [3.22] – 2026-05-31 – Security hardening: OAuth starts, Garmin secrets, dependency audit (v3.22.0)

### Investments: live gap from last price to fair value (v3.22.10)

The upside percent next to each verdict was reading the stored Notion Upside property, which is frozen at valuation time against the price then, so it never moved as the live price changed. It now computes the gap from the live last price to fair value, (fair − last) / last, in both the watchlist row and the detail view, falling back to the stored value only when there is no live quote. The verdict badge itself is left as the analyst's stored call. Follow-up flagged: have the valuation skill also store Fair value low/high, and optionally re-derive the verdict band from the live gap.

### Investments quotes: preserve 7d/30d across a blank fetch (v3.22.9)

The 7d/30d columns are GOOGLEFINANCE history formulas that blank out for a moment while recalculating. A scheduled refresh that landed in that window was overwriting the whole row and wiping good 7d/30d values for the entire table (price and the 1-day change survived because those columns never blank). The cron now reads the prior stored 7d/30d and keeps them when the new fetch returns null, so a single mistimed snapshot can no longer blank the columns. Follow-up to the v3.22.4 multi-period feature; closes the partial-fetch-resilience item from the 2026-06-07 backlog note.

### Current Events outlet blocklist expansion (v3.22.8)

Nine more low-signal outlets dropped at the RSS ingestion layer. International: Golf Channel, Defector, RACER (motorsports). Indonesia: industry.co.id, butota.id, Esports ID, niaga.asia, gadgetdiva, indonesiadefense.com. Same case-insensitive substring matching as prior sweeps; takes effect on the next news-synthesis cron slot. Salvaged from an abandoned worktree during branch cleanup.

### Investments: 1D/7D/30D price changes + explicit fair value (v3.22.4)

The `/investments` table now shows each name's last price against the previous day, 7 days, and 30 days, and shows the exact computed fair value alongside the range and the valuation date.

- `src/app/investments/page.tsx`: the last-price cell renders 1D / 7D / 30D deltas (color-coded); the fair-value cell shows the explicit `Fair value per share` plus the low–high range and an "as of" valuation date; the detail view mirrors this (Fair value / Range / Last price / Upside / Valued on + period deltas).
- `src/lib/investments/quotes.ts`, `sgxQuotes.ts`, `sheetQuotes.ts`: the `Quote` / `SourceQuote` types carry `changePct7d` / `changePct30d`; the sheet reader parses two new CSV columns; SGX has no history feed, so those stay null there.
- `src/lib/sync/investmentQuotes.ts`: stores and reads `change_pct_7d` / `change_pct_30d`.
- `src/data/watchlist.ts`: added ISAT (Indosat Ooredoo Hutchison) under Telecom; removed ASSA and JSMR.
- Migration `031`: adds nullable `change_pct_7d` / `change_pct_30d` to `investment_quotes` (applied to prod).
- Source: added two GOOGLEFINANCE-history columns and an ISAT row to the published "Jarvis Investment Quotes" sheet.

### Investments quote pipeline hardening: percent-aware + quote-aware CSV + cache-bust (v3.22.5–3.22.7)

Firing the cron against live data surfaced three parsing/caching issues, each fixed:

- v3.22.5 — `parseNum` is now percent-aware: the sheet may format change cells as a percent (-6.45%) or a raw fraction (-0.0645); both normalize to a fraction, so a sheet formatting change can no longer skew values 100x (this also protected the existing 1-day change).
- v3.22.6 — quote-aware CSV parsing: prices with a thousands separator are CSV-quoted with an internal comma ("5,075.00"); the old `line.split(',')` tore the field and shifted every later column (TLKM briefly stored as price 2). Replaced with a quote-respecting line splitter.
- v3.22.7 — cache-bust the published-CSV fetch: Google serves it with a 5-minute edge cache (max-age=300), so the cron could read a stale snapshot taken while the slower GOOGLEFINANCE history columns were mid-recalc (empty), storing null 7d/30d. The fetch now appends a per-call cache-buster and sets `cache: 'no-store'`.
- Verification: cron fired in prod, 46/46 priced; Supabase shows correct price + 1D/7D/30D for IDX and US names (TLKM 2,760 / −4.8% / −6.4% / −5.8%; ISAT 1,880 / −8.7% / −11.7% / −12.6%).

### Investments page: manual Refresh button to pick up new valuations (v3.22.3)

The `/investments` valuation list is cached in server memory keyed by UTC date, so a newly published Notion valuation only appeared after the next UTC midnight or a redeploy. Added a manual refresh path so a new valuation surfaces on demand.

- `src/lib/investments/valuation.ts`: exported `clearValuationCaches()` to drop the day-keyed valuation and memo caches.
- `src/app/api/investments/route.ts`: a `?refresh=1` query param clears those caches before serving, so the next read re-queries Notion.
- `src/app/investments/page.tsx`: added a Refresh button in the header that calls the refresh path, re-pulls valuations and quotes, and clears the client-side memo cache.
- Stored quotes already read straight from Supabase (no in-memory cache), so prices were never the stale part; this only affects valuations.

### Investments quotes: replace blocked Yahoo with a Google Sheet (US+IDX) and the SGX API (v3.22.2)

The investments price pull works again. Yahoo's quote endpoint returns HTTP 429 from datacenter IPs (both dev and Railway), so the few-times-a-day refresh was storing zero prices. Replaced Yahoo with two reachable, key-free sources.

- `src/lib/investments/sheetQuotes.ts`: reads US and IDX quotes from a published-to-web Google Sheet of GOOGLEFINANCE formulas in one CSV fetch. The sheet does the per-symbol fan-out; the app parses ticker, price, and changePct (stored as a fraction). The CSV URL defaults in code (public, non-secret) and is overridable via `INVESTMENTS_SHEET_CSV_URL`.
- `src/lib/investments/sgxQuotes.ts`: reads the three SGX banks (DBS, OCBC, UOB) from SGX's own public delayed-price JSON feed, because Singapore Exchange revoked GOOGLEFINANCE access and Yahoo is blocked. One request returns the whole board; we pick the counter codes we track.
- `src/lib/sync/investmentQuotes.ts`: now merges the sheet (US + IDX) and the SGX feed, derives currency by exchange (IDR/SGD/USD), and keeps the upsert-only-priced guard so a transient outage never blanks stored values. The Yahoo fetcher (`quotes.ts`) is no longer used.
- Verification: build passes; the published CSV returns all 44 US+IDX rows priced; the SGX feed returns the three banks' last prices.

### Prompt-injection hardening for email and delta prompts (v3.22.1)

Closed the remaining high-priority prompt-injection item from the 2026-05-31 security review. The remaining Claude prompt surfaces that embed email/task/calendar-derived data now sanitize fields, wrap external text in explicit untrusted-data delimiters, and include the shared untrusted-content preamble.

- `src/app/api/emails/synthesize/route.ts`: added runtime request validation for the caller-provided email list (1-50 emails, bounded fields), sanitizes email metadata/snippets, wraps the email block with `wrapUntrusted('untrusted_emails', ...)`, includes `UNTRUSTED_PREAMBLE`, and routes errors through `safeError`.
- `src/app/api/emails/style-analysis/route.ts`: sanitizes sent-email metadata/body text and wraps the examples with `wrapUntrusted('untrusted_sent_emails', ...)`, because sent email bodies can include quoted external replies.
- `src/app/api/briefing/delta/route.ts`: sanitizes calendar titles, task titles/priorities, email subjects/senders/labels before composing change details, then wraps the change list with `wrapUntrusted('untrusted_changes', ...)` for the Claude delta prompt.
- `src/lib/validation.ts`: added `EmailSynthesisSchema` to cap manual email synthesis input before prompt construction.
- Verification: `npm run build` passes on Next 16.2.6. The build still emits the known middleware-to-proxy deprecation warning only.

Implementation commit: `6dbecb78a6eb129721135d17ae5035104b883822`.

First high-priority security batch shipped. OAuth connect initiation now requires an authenticated Jarvis browser session, legacy Garmin local scripts no longer write plaintext tokens or raw payloads, and the dependency audit is clean at high severity and overall.

- `src/app/api/auth/google/route.ts` and `src/app/api/auth/microsoft/route.ts`: OAuth start routes now use `withAuth`; unauthenticated direct hits return 401, while authenticated reconnect flows still redirect to Google/Microsoft and set the signed `jarvis_oauth_state` cookie. Callback routes remain public and state-protected.
- `scripts/crypto-helper.mjs`: new script-side AES-256-GCM helper that matches the app ciphertext envelope (`enc:v1:<iv>:<tag>:<ciphertext>`).
- `scripts/seed-garmin-tokens.mjs`: requires `SUPABASE_SERVICE_ROLE_KEY` and `CRYPTO_KEY`, removes anon/publishable fallback, writes only `garmin_tokens.tokens_encrypted` for `id = 'default'`, and clears the legacy `sync_status.last_error` for `garmin-tokens`.
- `scripts/backfill-recent.mjs`: requires service-role Supabase access and crypto configuration, stores Garmin daily `raw_json` as encrypted JSONB (`{ enc: ... }`), and persists refreshed Garmin tokens only through the encrypted token table.
- `package.json` / `package-lock.json`: bumped Jarvis to v3.22.0, Next to 16.2.6 in dependencies and devDependencies, and pinned patched vulnerable transitives with overrides: axios 1.16.1, follow-redirects 1.16.0, lodash 4.18.1, postcss 8.5.15, qs 6.15.2, ws 8.21.0.
- Verification: `npm audit --audit-level=high` reports 0 vulnerabilities, `npm ls next axios follow-redirects lodash postcss qs ws` resolves to the patched versions, `npm run build` passes, direct unauthenticated OAuth start requests return 401, authenticated start requests redirect with state cookies, and both Garmin scripts fail fast when `SUPABASE_SERVICE_ROLE_KEY` is missing.

## [3.21] – 2026-05-30 – Investments watchlist: last price vs valuation fair-value range, drill-in memos (v3.21.0)

New Investments page (`/investments`): a watchlist grouped by exchange then industry, each row showing the last price against the valuation fair-value range and a verdict pill with upside, plus a "Details" link that drills into the full exec-summary memo. Valuations and memos are read live from the Notion "Valuation models (DCF)" database (joined by ticker); the watchlist universe lives in code. Prices are refreshed by a cron job a few times a day (around each exchange's mid-day and close) and stored, rather than pulled live on every page load. This suits a fundamental-investor cadence and avoids hammering the upstream.

- `supabase/migration-030-investment-quotes.sql`: new `investment_quotes` table (one row per ticker: price, currency, change_pct, fetched_at). RLS enabled with no permissive policy (service-role key only, matching migration-027). Applied to production.
- `src/data/watchlist.ts`: the watchlist universe (exchange, industry, company) plus helpers (`flatCompanies`, `yahooSymbol`). The US "AI infrastructure & platforms" group is split into Semiconductors (NVDA, AVGO, TSM), Platforms & big tech (MSFT, GOOGL, META, AMZN, AAPL), and Software & dev infra (NET, DDOG, GTLB). SGX banks carry explicit Yahoo codes (D05.SI, O39.SI, U11.SI).
- `src/lib/investments/valuation.ts`: live reader for the Notion DCF database. `listValuations()` returns structured props for every memo (now including fair-value low/high); `getMemoForTicker()` returns the full markdown plus props. Day-keyed in-memory cache so navigation does not re-hit Notion. Added `Fair value low` and `Fair value high` number columns to the Notion database and backfilled BBCA from its sensitivity run.
- `src/lib/investments/quotes.ts`: per-symbol fetch from Yahoo's public chart endpoint with a browser User-Agent, a per-request timeout, and a short cache. Never throws; returns a null price on any failure.
- `src/lib/sync/investmentQuotes.ts`: `syncInvestmentQuotes()` pulls every watchlist symbol and upserts only the priced rows, so a transient upstream failure never blanks the last good value. `getStoredQuotes()` reads the last stored quote per ticker plus the most recent refresh time.
- `src/app/api/investments/route.ts` (GET, cookie auth): three modes (valuations list, stored quotes, single-ticker memo), all routed through `safeError`.
- `src/app/api/cron/investment-quotes/route.ts` (GET, cron auth): the scheduled refresh entry point wrapped in `runCronJob`.
- `src/app/investments/page.tsx`: the master-detail UI, with XSS-safe memo rendering via `src/lib/investments/renderMemo.ts`. `src/components/Sidebar.tsx`: new Investments nav item.
- Scheduling is a manual cron-job.org step (no workflow file is checked in): runs covering each exchange's mid-day and close in WIB. Prices populate on the first successful run.

## [3.20] — 2026-05-30 — Career page filters + Singapore/Jakarta base restriction (v3.20.0)

### Career data-pull health check on the page and in Utilities (v3.20.2)

Surfaced per-source data-pull health so a broken source is obvious at a glance, using the per-source status the sync already records in `sync_account_status`.

- `src/app/api/career/route.ts`: the `sources` payload now includes each source's `count` (the raw rows fetched, from `events_synced`).
- `src/app/career/page.tsx`: a "Sources" health strip under the header shows every source with a status dot and its fetched count — green for a healthy pull, amber "blocked" for a best-effort source that is expected to fail (Revolut), red "failed" for a genuine failure. This makes the working-vs-broken split visible (e.g. Anthropic 377, OpenAI 716, Grab 348, GoTo 12, Stripe 62 green; Revolut amber). The strip shows the raw pull count, so a source that fetched fine but has no senior matches (GoTo, Stripe) still reads as healthy.
- `src/app/api/utilities/integrations/route.ts`: added `career-jobs` to the expected-interval map (label "Career Job Watch", twice-weekly cadence) so it appears as a proper connector card instead of a raw `career-jobs` row with a mis-flagged interval.
- `src/app/utilities/page.tsx`: career sources show under the Career Job Watch connector with the `source:` prefix stripped (Anthropic, OpenAI, …), and a `CJ` icon. Revolut surfaces as the unhealthy account with its Cloudflare error.
- No schema change; both surfaces read existing `sync_account_status` / `sync_status` data.

### Stricter seniority filter, legal/audit/accounting excluded, facet z-index fix (v3.20.1)

Tightened the watch to genuine senior leadership and fixed a filter-dropdown layering bug.

- `src/lib/sources/careers/filter.ts`: replaced the below-bar exclude with a positive seniority gate. A role is kept only if its title carries a senior marker (Head, Chief, President, VP, Director, Principal, Managing Director, General/Country Manager, or Lead/Leader). Plain Manager and Senior Manager are now dropped. Added legal, counsel, audit, accounting, and tax to the hard-excludes (Filman ruled those functions out). Removed the architect exclude, since architecture is relevant. Verified against 19 title cases.
- `src/app/career/page.tsx`: the facet dropdown panel now has `z-50` so it layers above the other facet buttons (it was rendering behind "Type of work" on the wrapped mobile layout). The work-type taxonomy gained General Management (GM / P&L / business-unit) and Architecture categories, renamed Risk & Audit to Risk (audit is now excluded), and dropped tax/accounting from Finance.
- Re-scan + cleanup: the new filter closed 46 disqualified roles (Manager-level, audit, etc.), which were then deleted, and scored the remaining qualifying roles. The watch now holds 30 fully-scored Singapore/Jakarta senior roles (Grab 17, OpenAI 13); GoTo and Stripe dropped to zero as none of their current open roles cleared the seniority bar. Default view shows 1 fit plus 12 partial.


The career watch is now restricted to roles based in Singapore or Jakarta (Filman's only acceptable bases), and the page gains four client-side filter facets.

- `src/lib/sources/careers/filter.ts`: the location gate now keeps a role only if its base location names Singapore or Indonesia/Jakarta. Dropped the rest of SEA (KL, Bangkok, Manila, HCMC), broad APAC/remote, and everything else. One-time production cleanup deleted 70 out-of-base rows; 75 Singapore/Jakarta rows remain.
- `src/app/career/page.tsx`: four multi-select filter facets, all derived client-side from the fields the API already returns (no schema change):
  - **Company** — Anthropic, OpenAI, Grab, GoTo, Stripe, Revolut.
  - **Base** — Singapore or Jakarta, from the location string (a compound location can match both).
  - **Scope** — the role's mandate breadth (Global / APAC / SEA / Country) inferred from the title.
  - **Type of work** — a normalized cross-company function taxonomy (Strategy, GTM & Sales, Finance, Product, Operations, Marketing, Policy & Public Affairs, People, Risk & Audit, Data, Other) derived from department + title.
  Each facet is a dropdown of checkboxes with live counts. Selections combine AND across facets, OR within a facet; a "Clear filters" control resets them. The existing fit+partial and hide-closed toggles are unchanged. Subtitle now reads "Singapore and Jakarta roles…".

## [3.19] — 2026-05-29 — Career job watch: twice-weekly role scan across Anthropic, Stripe, Revolut with LLM fit scoring (v3.19.0)

### Grab and GoTo added as sources, plus a below-bar title pre-filter (v3.19.3)

Broadened the watch to Grab and GoTo (now six sources), and added a seniority pre-filter so high-volume employers do not flood scoring with sub-Director roles.

- `src/lib/sources/careers/grab.ts`: Grab via SmartRecruiters' public posting API (paginated, ~348 roles). The list endpoint carries no job description, so `description_raw` is null (same as Stripe) and scoring falls back to title and department. Fails closed on any page error, so partial data never mis-triggers closures.
- `src/lib/sources/careers/goto.ts`: GoTo Group via the gotocompany.com careers JSON API (`content.goinfra.co.id/ent-hris/career`). Exposes the HoldCo group-corporate roles only (~12, with full JD); Gojek, GoPay, and Tokopedia run on separate sites. Surfaces only published and publicly-listed roles.
- `src/lib/sources/careers/filter.ts`: new below-bar title filter drops Associate, Assistant, Officer, Coordinator, Analyst, Specialist, Representative, Administrator, and Clerk before scoring, unless the title carries a senior marker (Head, Director, Chief, VP, President, Partner, Principal, Managing Director, General Manager). Cuts Grab's in-region set from ~189 to ~116 and removes obvious not-a-fit noise across all sources. Verified against 16 title cases.
- `src/lib/sources/careers/index.ts`: `grabSource` and `gotoSource` appended (now Anthropic, OpenAI, Grab, GoTo, Stripe, Revolut). `src/app/career/page.tsx`: subtitle names all six.
- First scan: 145 kept across all sources, 40 scored this run (the per-run cap), 105 queued for later runs. New in-region results include an OpenAI "Head of APAC Growth Markets" (fit, 85) plus three Grab strategy partials in Malaysia, Thailand, and the Philippines.

### OpenAI added as a fourth career source via Ashby (v3.19.2)

Broadened the watch to OpenAI. OpenAI publishes its board through Ashby's clean public posting API, so it slots in next to the Anthropic Greenhouse source with no scraping. First scan: 708 roles fetched, 21 kept after the in-region location and category gate, 4 scored partial, 17 not a fit. The 4 partials are all Singapore GTM/deployment leadership roles (Lead AI Deployment Manager, Technical Deployment Lead, APAC Sales Development Leader, VC Partnerships Lead APAC); the Global Affairs strategy roles scored not a fit.

- `src/lib/sources/careers/openai.ts`: new `openaiSource` reading `api.ashbyhq.com/posting-api/job-board/openai`. Maps Ashby fields (id, title, department/team, descriptionPlain) and folds primary plus secondary locations into one string, so an in-region secondary location still passes the gate. Skips unlisted roles; throws on zero listed jobs so an API shape change surfaces as a source failure instead of a silent empty result.
- `src/lib/sources/careers/index.ts`: `openaiSource` appended to `CAREER_SOURCES` (now Anthropic, OpenAI, Stripe, Revolut).
- `src/app/career/page.tsx`: page subtitle now names OpenAI.

### Career location filter tightened to Indonesia / Singapore / SEA / APAC + Revolut banner suppressed (v3.19.1)

The location gate kept too much: it admitted ANZ, South Asia, and single-country East Asia roles (Sydney, Bengaluru, Tokyo, Seoul) that are not relevant. New bar: a role must plausibly include Indonesia, meaning Indonesia itself, Singapore (the regional hub), any SEA market, or a broad APAC / Asia-Pacific / remote-APAC label. ANZ, South Asia (India and neighbours), and single-country East Asia (Japan, Korea, China, Hong Kong, Taiwan) are now dropped before scoring. Compound locations still pass on any in-region hit, so "Singapore; Tokyo" stays while "Tokyo, Japan" alone drops.

- `src/lib/sources/careers/filter.ts`: `APAC_PATTERNS` reduced to Singapore, APAC / Asia-Pacific, SEA / Southeast Asia, Indonesia, Malaysia, Thailand, Philippines, Vietnam, and Cambodia. Removed the Japan, ANZ, Korea, Hong Kong, India, and Taiwan patterns. Verified against 24 location cases.
- One-time cleanup of the production table: 30 of 32 stored rows were out-of-region (ANZ, Japan, Korea, India) and were deleted; the 2 in-region Singapore rows (both not a fit) remain. The default fit-plus-partial view is empty until a relevant in-region role opens, which is the stricter filter behaving as intended.
- `src/app/career/page.tsx`: Revolut (and any future best-effort source with no reliable automated path) no longer surfaces as a standing failure banner. The source stays wired so it auto-resumes if a path opens; genuine failures from Anthropic or Stripe still show a banner. Probed Greenhouse, Lever, Ashby, SmartRecruiters, and Revolut's own endpoints: no clean public jobs API exists and every Revolut route returns a Cloudflare 403.

New Career page (`/career`) that checks open roles at Anthropic, Stripe, and Revolut twice a week (Tue/Thu, 07:00 WIB), filters to in-region (Singapore / APAC / APAC-remote) leadership-track roles, and scores each against Filman's profile with the Anthropic API. Each role gets a fit verdict (fit / partial / not_fit), a 0-100 score, a plain-language summary, and a fit rationale that explains level mismatches explicitly.

- `supabase/migration-029-career-job-watch.sql`: new `career_job_watch` table (`unique (company, external_id)`), RLS enabled with no permissive policy (service-role key bypasses RLS, matching migration-027 posture). Indexes on `company` and `status`. Applied to production.
- `src/lib/sources/careers/`: pluggable source layer with per-source isolation.
  - `anthropic.ts`: clean Greenhouse board API (`boards-api.greenhouse.io`), ~388 roles. Proven first to validate the pipeline.
  - `stripe.ts`: server-rendered HTML scrape of the jobs search page, ~62 roles. Throws on zero rows so a markup change surfaces as a source failure rather than a silent empty result.
  - `revolut.ts`: best-effort fetch; detects Cloudflare bot protection and returns a clean failure (currently blocked, HTTP 403).
  - `filter.ts`: location gate (keep SG/APAC/APAC-remote, drop US/EU-only) plus hard-exclude of engineering, design, support, AML, and early-career roles before any LLM call. `html.ts`: entity-decode + tag-strip for Greenhouse job descriptions. `profile.ts`: the verbatim profile block. `types.ts`: `RawJob` / `JobSource` contracts.
- `src/lib/sync/careerJobWatch.ts`: core `syncCareerJobs()`. Fetches all sources in parallel with try/catch isolation, records per-source health in `sync_account_status`, applies the location/category filter, diffs against the table by `(company, external_id)`, inserts new rows (status `new`), preserves user status on updates, reopens previously-closed roles, and sets `closed_at` for roles that vanished. Only new or changed rows are scored, capped at 40 LLM calls per run, guarded by the usage rate-limit check. Scoring uses Sonnet with prompt caching on the instructions + profile block; all job text is sanitized and `wrapUntrusted`-wrapped before reaching the prompt.
- `src/app/api/career/route.ts` (GET, cookie auth): roles grouped for the page plus per-source health and last-refreshed timestamp. `src/app/api/career/refresh/route.ts` (POST): browser-triggered on-demand scan, same pipeline as the cron. `src/app/api/career/status/route.ts` (PATCH): write back status (new / reviewing / applied / passed), validated by `CareerStatusSchema`. `src/app/api/cron/career-jobs/route.ts` (GET, cron auth): the scheduled entry point wrapped in `runCronJob`.
- `src/app/career/page.tsx`: groups roles by company, sorts fit before partial before not_fit (then score desc), shows verdict badge (green / amber / grey), score, summary, rationale, first-seen date, Apply link, and a status dropdown with optimistic write-back. Defaults to fit + partial only with a "show all" toggle, plus a "hide closed" toggle and a source-failure banner. `src/components/Sidebar.tsx`: new Career nav item.
- `src/lib/validation.ts`: `CareerStatusSchema` (UUID id + status enum).
- Scheduling is a manual cron-job.org step (no workflow file is checked in): a Tue/Thu job at `0 0 * * 2,4` UTC hitting the deployed `/api/cron/career-jobs` with the `x-cron-secret` header.

## [3.18] — 2026-05-27 — HR Zone Calculator: 4 new experts, median consensus, category grouping (v3.18.0)

Cardio page HR Zone Calculator extended from 6 to 10 methods per mode, with the consensus rule switched from a strict floor/ceiling to median across all methods. Adds 4 named experts (San Millán, Lyon, Patrick, Huberman), groups bars by category (Formulas / LTHR-based / Experts), and surfaces a per-method rationale in the chart tooltip.

- `src/components/HRZoneCalculator.tsx`:
  - Added San Millán (70-80% max for Z2, ~95% max floor for Z5 from 4×4 protocol), Lyon (60-65% Z2, 85-95% Z5 VO2 max band), Patrick (70-80% Z2, ≥95% Z5), Huberman (55-70% Z2, 80-100% Z5). Bare omitted since his Z2 maps to the existing MAF row (180-age).
  - `ZoneMethod` now carries `category` (formula / lthr / expert) and `rationale` (one-sentence source paraphrase) fields.
  - Bars sort by category left-to-right and legend renders with category headers.
  - Tooltip shows method name, category badge, bpm range, expert attribution, and rationale.
  - Consensus computed two ways: **median** (default) across all methods, **strict** (highest floor / highest ceiling for Z2; floor spread for Z5) as a toggle. Active band is shaded; inactive rule's min/max appear as faint dashed reference lines.
  - Y-axis domain is now data-driven (`min - 5` to `max + 5`) instead of hard-coded, so Huberman's lower Z2 floor and Lyon's lower Z2 ceiling fit cleanly.
  - Coggan Z5 and Friel Z2/Z5 ceilings clamped at `maxHR`; rows where `low >= high` after clamping are filtered out (previously Coggan rendered an inverted range when LTHR > 91% of maxHR).
- Expert HR ranges are sourced from each expert's NotebookLM notebook in the personal library. Bare's view was queried but folded into MAF rather than added as a redundant row.
- No API or schema changes. `/api/cardio/hr-zones` continues to return `{age, restingHR, lthr, maxHR, maxHrSource}` unchanged.

### Garmin sleep/HR/steps off-by-one date fix (v3.17.2)

Daily Garmin metrics were stored one day ahead of the night they actually measured. `syncGarmin` built the date object as midnight WIB (17:00 UTC the prior day). The `garmin-connect` library's `toDateString` formats with the server timezone (UTC on Railway), so the request silently rolled back a day: requesting `today` returned the night with Garmin `calendarDate = today - 1`. The row labelled `2026-05-22` actually held the night that ended on May 21. Last night's real sleep score (45) never landed; the dashboard showed the prior night (65).

- `src/lib/sync/garmin.ts`: new `garminDateObj(dateStr)` helper anchors the library date at noon UTC so the resolved calendar date equals the intended WIB date for any realistic server timezone. Used in `syncGarmin`, the incremental backfill, and `backfillDateRange`, which were the three sites feeding `getSleepData` / `getSteps` / `getHeartRate`.
- Affected columns (all date-shifted by one): `sleep_score`, `sleep_duration_seconds`, `resting_hr`, `steps`, `body_battery_charged`. Endpoints that embed the date string directly in the URL (stress, hrv, training readiness/status, body battery, fitness age) were already correct.
- `backfillDateRange` was also writing `raw_json` unencrypted (plain insert, no `wrapJsonb`); now wrapped to match the other write paths.
- Backfill: corrected existing rows via an in-place column shift in Supabase (each row's five shifted columns belong to the previous date; zero Garmin API calls, avoids the daily-budget circuit breaker) plus a one-off re-sync of the current day after deploy. Pre-shift snapshot kept in `garmin_daily_dateshift_bak_20260522`.
- No schema, cron, or migration changes.

### Per-lap cadence in weekly briefing prompt (v3.17.1)

After v3.17.0 fixed the activity-level cadence number, Claude still only saw a single cadence value per run, so it could (and did) hallucinate within-run trajectories like "cadence dropped over the 55-minute Z2 portion." `SplitData.cadence` was already populated from `lap.averageRunCadence` during enrichment but was being stripped by the Lap Profile serializer, so it never made it to Notion or to the briefing prompt.

- `src/lib/running-analysis/garmin-enrich.ts`: `serializeLapsForProperty` and `LapData` now carry a `c` field (steps per minute, both legs). `parseLapsFromProperty` reads `c` with a null fallback so older Lap Profile rows (without `c`) still parse cleanly.
- `src/lib/running-analysis/analysis-engine.ts`: the per-lap line in the weekly briefing prompt now appends `cad N spm` when present. Also updated the activity-level cadence label so Claude knows the value is now Garmin's run-only average (not the v3.17.0-removed dilution) and points to the per-lap table for within-run drift.
- Backfill: re-ran `POST /api/running-analysis` with `force_resync: true` after deploy so existing Lap Profile rows in Notion are rewritten with the new `c` field.

## [3.17] — 2026-05-09 — Cadence calculation fix: prefer Garmin run-only average over diluted moving-time compute (v3.17.0)

The activity-level cadence reported in weekly briefings was being computed as `steps / movingDuration`, which dilutes with any walking segments and underreports the true running cadence. On Saturday's long run, the local compute returned 157 spm while Garmin's own `averageRunningCadenceInStepsPerMinute` (averaged only over time spent actually running) was 163. The weekly briefing then narrated "form breakdown to 157 spm" from a number that was a calculation artifact, not real form drift.

- `src/lib/running-analysis/index.ts`: cadence now prefers `raw.averageRunningCadenceInStepsPerMinute` (Garmin's run-only value, matches the Garmin Connect app), falling back to `steps / movingDuration` only when missing. Comment updated to explain the dilution problem.
- `scripts/inspect-activity.ts`: one-shot read-only diagnostic that decrypts a `garmin_activities.raw_json` row and prints cadence-related fields. Used to surface the 157 vs 163 discrepancy. Kept for future debugging.
- Backfill: re-ran `POST /api/running-analysis` with `force_resync: true` after deploy to overwrite stored cadence values in the Notion Runs DB so the cardio-analysis page and weekly insights reflect the corrected number.
- No schema, cron, or migration changes.

## [3.16] — 2026-05-09 — Integration self-healing: invalid_grant detection, Reconnect CTA, Notion Tasks hardening (v3.16.0)

### Email triage Other-tab crash fix (v3.16.2)

Clicking the *Other* tab after selecting an email under *Needs response* threw `Cannot read properties of undefined (reading 'from_name')`. The selected key from the previous tab no longer matched any row, but the detail pane was rendering `OtherEmailDetail` with a `rows.find(...)!` non-null assertion before the clearing effect ran.

- `src/app/emails/page.tsx`: guard the *Other* detail render on `rows.find(...)` actually returning a row, falling back to the empty-state placeholder during the brief tab-switch race.

### Email triage list dedup (v3.16.1)

The `/emails` page was rendering duplicate rows for the same physical email when it surfaced under multiple `(message_id, source)` tuples (forwarded copy, sync re-import). Tab counts also drifted from the visible list.

- `src/app/api/emails/triage/route.ts`: collapse rows by `(sender_lower, subject, minute-bucket)` after the Supabase fetch, preferring the row with a draft and then the most recent `created_at`. `summary`, `needResponse`, and `otherEmails` are recomputed from the deduped set.
- `src/app/emails/page.tsx`: normalize `from_address` (trim + lowercase) in `groupNeedsResponse` and the selected-thread lookup. Other-tab list now keys rows by the same `(sender, subject, minute)` identity used server-side, so React keys stay unique even if a duplicate slips through.
- No schema or cron changes.

The integrations dashboard surfaced raw OAuth refresh tracebacks and a generic "Internal server error" for Notion Tasks, with no recovery path other than knowing to hit `/api/auth/google` manually. This pass turns each failure mode into either auto-recovery or a clear, actionable Reconnect link.

- `src/lib/google.ts`, `src/lib/microsoft.ts`: refresh now parses the OAuth error body, detects `invalid_grant` (also `interaction_required` / `consent_required` / `login_required` for Microsoft), flips `needs_reauth=true` on the token row, and throws a typed `NEEDS_REAUTH:<provider>:<id>` sentinel instead of a leaky 400-with-body error.
- `src/app/api/auth/google/callback/route.ts`, `src/app/api/auth/microsoft/callback/route.ts`: clear `needs_reauth=false` on successful re-auth.
- `src/app/api/utilities/integrations/route.ts`: joins `google_tokens` / `microsoft_tokens` and surfaces `needs_reauth` + `reauth_url` per account.
- `src/app/utilities/page.tsx`: replaces the raw error blob with a clickable "Reconnect" link when an account needs re-auth.
- `src/lib/sync/notionTasks.ts`: dedupes by `notion_page_id`, switches the single batch upsert to chunked upserts (50 per chunk) with per-row retry on chunk failure. One bad row no longer kills the whole sync; the offending row + Postgres error code are logged for diagnosis.
- `supabase/migration-028-token-needs-reauth.sql`: adds `needs_reauth boolean NOT NULL DEFAULT false` to `google_tokens` and `microsoft_tokens`. Applied to production.

User actions still required for the original incident: re-auth Google for both accounts and Outlook (the existing refresh tokens are revoked and only consent can mint new ones); confirm cron-job.org has the `notion-context` schedule enabled.

## [3.15] — 2026-05-02 — Security pass: error leak fix, prompt sanitize, cookie centralize (v3.15.0)

### Contacts: editable cards + correct "In Notion" tab (v3.15.1)

Two gaps on `/contacts` blocked real usage. After "Sync to Notion", a contact's status flipped to `synced` but the "In Notion" tab only matched `existing`, so freshly synced contacts vanished from every tab until the next scan re-detected them. The PATCH endpoint at `src/app/api/contacts/update/route.ts` already supported editing name/company/phone, but the UI rendered no edit affordance.

- `src/app/contacts/page.tsx`: "In Notion" tab filter now matches `status === 'existing' || status === 'synced'`. Tab count sums both. Each card has an Edit button that swaps into Name/Company/Phone inputs with Save/Cancel; only one card edits at a time.
- `src/app/api/contacts/update/route.ts`: after the local Supabase update, looks up `notion_page_id`; if present, propagates the same fields to the Notion page. Notion failures logged but don't fail the request.
- `src/lib/sync/contactScan.ts`: new exported `updateNotionContactFields(pageId, { name?, company?, phone? })`. Only patches keys passed in, so omitted fields aren't cleared.

No schema changes.

Three small security improvements identified in a full-codebase scan. No user-facing UX change for the happy path; failure messages now generic.

- `src/app/api/emails/style-analysis/route.ts`: per-account error strings now categorized server-side ("reconnect required" vs "temporary failure"). Outer 500 catch routed through `safeError()`. Raw provider error text no longer leaks to the client; full error still logged server-side.
- `src/app/api/health/blood-work/route.ts`: per-marker save failures return generic "save failed" instead of Supabase `error.message`. Outer catch routed through `safeError()`.
- `src/lib/sync/newsSynthesis.ts`: `emailSources`, `idnSources`, `intlSources` sanitized via `sanitizeInline` before joining into the news prompt and persisting. Closes a low-likelihood prompt-injection edge where a sender could craft a `From` header with control chars or tag fragments.
- `src/lib/auth.ts`: added `SESSION_COOKIE_OPTS` and `SESSION_COOKIE_MAX_AGE` constants. Login and logout now spread them so `httpOnly`, `sameSite`, `secure`, and `path` can no longer drift apart (mismatched attributes would prevent the browser from clearing the cookie).
- `CLAUDE.md`: documented the cookie convention under the Security posture section.

No schema changes. No new endpoints.

## [3.14] — 2026-04-29 — Schedule strip: highlight currently-active event (v3.14.0)

### Current Events outlet blocklist additions (v3.14.1)

Six more low-signal outlets dropped at the RSS ingestion layer.

- Indonesia: Portal Kabupaten Banjar, Perhutani, celebrity.okezone.com, Pontianak Post, Antara News Kalteng.
- International: NHL.com.
- `src/lib/sources/googleNewsRss.ts`: appends to the per-locale `BLOCKED_OUTLETS` lists.

The dashboard's "Today's Schedule" blue overlay was driven by a title-based heuristic — any event whose title contained "deep work" or "focus" got the accent treatment. Replaced with a time-based check so the highlight tracks the clock instead of the wording.

- `src/components/ScheduleStrip.tsx`: removed `isDeepWork()` (title substring match). Added `isActive(event)` returning true when `start_time <= now < end_time`. All-day events and events without an `end_time` are excluded. Polling cadence unchanged at 5 min — highlight can lag up to that long when an event ends, which is acceptable for this surface.
- No backend or schema changes.

## [3.13] — 2026-04-28 — Disable Jarvis email drafting (v3.13.0)

Jarvis was generating reply drafts for "needs response" work emails on every triage cycle and pushing them into Outlook. Filman never used the drafts and didn't have a fix in mind for their quality, so the feature is now disabled to stop burning Claude tokens (~2k tokens per batch of 3 emails, run 3× daily).

- `src/lib/sync/emailTriage.ts`: orchestrator skips Step 4 (Claude `generateDraftReplies`) and Step 5 (Outlook `createDrafts`). Classification (Step 3) still runs so the "Needs response" card on the dashboard stays populated. Helper functions and blocklist code intentionally left in place — re-enabling is a one-block revert per the inline comment.
- No schema changes. The `draft_*` columns on `email_triage` and the `email_draft_blocklist` table become dormant; UI shows zero drafted emails because the triage cron now reports `draftsCreated: 0`.
- Synthesis pipeline (daily butler voiceover) is untouched.

## [3.12] — 2026-04-27 — Current Events outlet blocklist expansion (v3.12.0)

Five more low-signal outlets dropped at the RSS ingestion layer.

- Indonesia: Urbanvibes.id, Zonautara.com, Disway Malang, Tribratanews Polda Jabar (both spellings — user wrote "Tribatranews"; correct outlet name is "Tribratanews").
- International: One Mile at a Time.
- `src/lib/sources/googleNewsRss.ts`: appends to the per-locale `BLOCKED_OUTLETS` lists.

## [3.11] — 2026-04-26 — Current Events outlet blocklist expansion (v3.11.0)

Nine more low-signal outlets dropped at the RSS ingestion layer for the Current Events card.

- Indonesia: Detiksport, Haloindonesia.co.id, Detikhealth, Tribunwow.com, Radar Tulungagung, Patrolmedia.co.id.
- International: Pats Pulpit, Steelers.com, NBA.com.
- `src/lib/sources/googleNewsRss.ts`: appends to the per-locale `BLOCKED_OUTLETS` lists. NBA scoped to `nba.com` to avoid over-matching (e.g., WNBA).

## [3.10] — 2026-04-25 — Weekly running analysis: lap-level granularity (v3.10.0)

### Current Events outlet blocklist additions (v3.10.7)

Ten additional low-signal outlets cluttering the Indonesia and International feeds are now dropped at the RSS ingestion layer.

- Indonesia: Haibunda, Fajar, Gizmologi.id, Mongabay.co.id, Goal.com.
- International: PFF (Pro Football Focus), Pro Football Reference, The Hollywood Reporter, Raiders.com, Minnesota Vikings, Deadline.
- `src/lib/sources/googleNewsRss.ts`: appends to the per-locale `BLOCKED_OUTLETS` lists. Same case-insensitive substring matching as v3.6.0.

### Persist measured max HR (v3.10.6)

The HR Zone Calculator's Max HR field has always been editable, but the value reset to the `220 − age` formula on every page load because nothing was persisted. The v3.4.0 retrospective noted that Z5 bands lean heavily on the age-based fallback until a real max is known. This ship persists the measured value through the existing `health_measurements` pipeline and adds a source indicator + nudge so it's obvious when the formula is in use.

- `src/app/api/health/measurements/route.ts`: adds `max_hr` to `VALID_TYPES` and `DEFAULT_UNITS` (unit: `bpm`).
- `src/app/api/cardio/hr-zones/route.ts`: queries the latest `health_measurements` row with `measurement_type = 'max_hr'` and prefers it over `220 − age`. Returns a new `maxHrSource: 'measured' | 'formula'` field.
- `src/components/HRZoneCalculator.tsx`: shows a small badge next to the Max HR field — amber `formula` or green `measured` — and renders a one-line nudge under the inputs when source is `formula`. The Max HR field commits on blur (or Enter) by POSTing a `max_hr` health_measurements row; on commit the badge flips to `measured` and the nudge disappears. Editing Age now only auto-recalculates Max HR while still on the formula — once a measured value exists, age changes leave it alone.
- The walk filter VO2-max false-positive backlog entry is closed in this ship as already-solved by v3.10.3 (HR tiebreaker on slow-paced activities). The "Preview weekly analysis" sub-item is closed as already-solved by the existing `/cardio-analysis` "Run Analysis" button.

### RLS hardening: drop permissive policies on 28 tables (v3.10.5)

Closed a real exposure: 28 `public` tables — including `google_tokens`, `microsoft_tokens`, `garmin_tokens`, `weight_log`, `health_measurements`, `blood_work`, `okr_targets` — carried `FOR ALL USING (true)` policies. Anyone holding the anon/publishable key could read or write them. The app uses the service-role key server-side, which bypasses RLS regardless, so dropping the policies is behaviorally equivalent for the app but locks out anon-key access entirely. Same pattern as `cron_run_log` and `email_draft_blocklist`.

- `supabase/migration-027-drop-permissive-policies.sql`: 28 `DROP POLICY IF EXISTS` statements. RLS stays enabled on every table.
- Verified via Supabase: `pg_policy` query for permissive `USING (true)` policies returns zero rows. Security advisor's WARN-level lints for this class are clear; tables now show INFO-level `rls_enabled_no_policy` (the desired posture — service-role-only access).
- CI guard (script that pings `get_advisors` and fails on ERROR-level lints) deferred to its own ship.

### Normalize legacy health_measurements rows (v3.10.4)

Drift from before the POST endpoint's `VALID_TYPES` was renamed left two `health_measurements` rows under old names (`dead_hang`, `ohs_major_compensations`). The OKR canonicalization shim was masking them. Migrated those rows to the canonical names (`dead_hang_seconds`, `overhead_squat_compensations`) and pruned the corresponding shim entries.

- `supabase/migration-026-normalize-measurement-types.sql`: rewrites `measurement_type` for the two legacy aliases. Two rows total, no UNIQUE collisions.
- `src/app/api/health-fitness/okr/route.ts`: removes `dead_hang` and `ohs_major_compensations` from `MEASUREMENT_TYPE_CANONICAL`. The remaining three entries (`waist_circumference`, `blood_pressure_systolic`, `blood_pressure_diastolic`) are NOT drift — they are the canonical DB names; the shim translates them to OKR's shorter `key_result` form. Comment rewritten to clarify the shim's actual purpose.

### Walk filter: HR tiebreaker for slow-paced VO2 max (v3.10.3)

v3.10.2 escaped the walk filter via a `force_resync` bypass, but that path would also let real walks back in (Apr 22's archived "Treadmill Walking" would re-ingest on the next force_resync). Replaced with a smarter universal filter that uses avg HR as a tiebreaker on slow-paced activities. Real running — even with long rests between VO2 intervals — keeps avg HR ≥ 130; sustained walking sits at 120 or below.

- `src/lib/running-analysis/index.ts`: rewrite the walk filter. Activities with avg pace ≤ 10:00/km always pass. Slower activities pass only if avg HR ≥ 130. Reverted v3.10.2's `forceResync` bypass — no longer needed and cleaner without it.
- Verified against Supabase rows: Apr 21 VO2 (11:33/km @ 143 HR) passes; Apr 22 walk (13:01/km @ 120 HR) drops. Both have `activity_type: 'treadmill_running'` so HR is the only reliable separator.

### Skip walk filter on force_resync (v3.10.2)

The v3.4.0 walk filter (drop activities with avg pace slower than 10:00/km) catches incline-walk sessions correctly but false-positives on VO2 max workouts whose long interval-rest gaps drag the avg pace above 10:00/km. Apr 21's VO2 session logged at 11:32/km got blocked at the Supabase query layer, so v3.10.0's force_resync of the week-of-Apr-20 couldn't write Session Profile / Lap Profile to it.

- `src/lib/running-analysis/index.ts`: the walk filter now skips when `options.forceResync === true`. User-driven re-ingestion is an explicit "trust me, pull this in" — once the splits go through `enrichActivity` + `classifyLaps`, real walks tag as `main` only and surface as a `Z2 base` Session Profile (not harmful), while real VO2 sessions surface their interval structure correctly.
- The walk filter still applies on the default ingest path (Saturday cron, non-force-resync) — no change to the v3.4.0 guarantee.

### Ensure Runs DB schema before ingest writes (v3.10.1)

v3.10.0 added two new properties (`Session Profile`, `Lap Profile`) to `RunActivity` and `buildProperties()`, but Notion's API rejects writes to property keys that don't exist in the database schema with a `validation_error`. Without a schema-ensure step, the first force_resync after deploy would 400 on every page write.

- `src/lib/running-analysis/notion-runs-db.ts`: new exported `ensureRunsDbSchema(apiKey)` — GETs the Runs DB definition, computes the set of missing required columns (currently the two new rich_text fields), and PATCHes the database with just the missing keys. Idempotent: when both columns exist it short-circuits without a PATCH. Mirrors the pattern in `weekly-insights-db.ts:ensureDbSchema`.
- `src/lib/running-analysis/index.ts`: `runRunningAnalysis()` calls `ensureRunsDbSchema` once at the top of the orchestrator, before any page write. Wrapped in try/catch so a transient Notion failure doesn't block the analysis run.

## [3.10] — 2026-04-25 — Weekly running analysis: lap-level granularity (v3.10.0)

After v3.9.0 dropped the adherence lens, the prose still couldn't recognize VO2 max sessions because the prompt only saw activity-level averages — Apr 21's intervals read as "poor execution at 11:32/km" because the model had no way to know that 11:32 average was a 4×4min @ Z5 work + 2min recovery structure. The classifier from v3.7.2 already labels every lap as warm-up/main/tempo/interval-work/interval-rest/cool-down from HR floor + duration + alternation; the labels just never reached the analysis prompt. This ship plumbs them through.

- `src/lib/running-analysis/garmin-enrich.ts`: three new helpers alongside `classifyLaps()`. `summarizeSegments(splits)` derives a one-line authoritative session-type label from segment composition (e.g., `VO2 max intervals: 4×4min @ 178 HR, ~2min recovery`, `Z2 base 30min + 8min tempo finish`, `Z2 base ~45min`). `serializeLapsForProperty(splits)` JSON-encodes a compact per-lap shape (`{i, t, d, du, hr, p}` with single-letter segment-type codes). `parseLapsFromProperty(json)` is the inverse.
- `src/lib/running-analysis/notion-runs-db.ts`: `RunActivity` extended with `sessionProfile` and `lapProfileJson`. `buildProperties()` writes them as two new rich_text properties on the Notion Runs DB row: `Session Profile` and `Lap Profile`. Both are populated at ingest from the already-classified splits — no extra Garmin fetch.
- `src/lib/running-analysis/index.ts`: `extractRunActivity()` calls the two helpers and stuffs the strings into the activity object.
- `src/lib/running-analysis/analysis-engine.ts`:
  - `WeeklyRunSummary` extended with `sessionProfile: string | null` and `laps: LapData[]`.
  - `extractRunSummaries()` parses both new properties from the Notion page.
  - The `runsDetail` block now appends a Session profile line plus a `Laps:` table under each run with one row per lap (segment type, distance, duration, pace, HR), capped at 30 laps defensively.
  - New prompt rules under the existing TIMING / WALKING / ADHERENCE blocks: Session profile is the AUTHORITATIVE session-type label (do NOT infer from avg pace or avg cadence — both are diluted by warm-up/cool-down/rest segments in any structured workout). Cite lap-level numbers over activity-level when the lap data is more telling — work-interval pace + HR + drift across reps for VO2 max, tempo split for hybrid runs, decoupling between early/late main laps for long runs.
- Backfill: no separate script needed. `POST /api/running-analysis` with `force_resync: true` re-ingests the week's runs and patches the Notion pages with the new properties via the existing `patchRunPage()` flow.
- No Supabase schema change. No UI change. Costs unchanged (no extra Garmin or Anthropic calls per run; just denser prompt input).

## [3.9] — 2026-04-25 — Weekly running analysis: drop the adherence lens (v3.9.0)

The v3.8.0 prompt fixed timing and walks, but the regenerated week-of-Apr-20 prose still led with "complete plan deviation" framing — scolding real running sessions on plan-coded walk days, missing cross-week catch-ups, and manufacturing concerns out of schedule comparison. The user's feedback was direct: "I don't want any feedback on deviation at all — that's less of my concern." This ship rips out the adherence lens entirely.

- `src/lib/running-analysis/analysis-engine.ts`:
  - Reduced the dual-lens framing ("WEEKLY MIX" + "PROGRESSION IN CONTEXT") to a single lens — PROGRESSION IN CONTEXT only. The model no longer evaluates whether the planned session mix was delivered.
  - Added an explicit "ADHERENCE IS NOT YOUR LENS" rule directly under the lens framing: not evaluating missed/substituted/moved/carried-across-week sessions; the runner manages their own schedule.
  - Repurposed the THIS WEEK / LAST WEEK plan blocks as session-intent context only — labeled as such, with a "HOW TO USE THE PLAN" rule that explicitly forbids using it as a grading rubric. The plan is now there ONLY so the model can interpret what each completed run was meant to be (Z2 vs tempo vs VO2 vs long run) when judging execution quality.
  - Section 1 (HOW WAS THIS WEEK) rewritten to lead with the SHARPEST progression signal from runs that DID happen — like-for-like pace at HR, cadence step-up, decoupling on a long run, tempo split, VO2 interval read. No commentary on what was/wasn't done versus the plan.
  - Section 3 (WHAT NEEDS WORK) rewritten to flag execution gaps in the actual runs only, with explicit bans on flagging missed sessions, off-plan substitutions, day-of-week shifts, weekly volume vs plan, or walk/rest-day deviation. If the runs that happened look fine, the model is told to say so in one sentence — not manufacture concerns.
  - Section 4 (FOCUS NEXT WEEK) tightened to forbid relitigating this-week adherence in its setup; still references NEXT WEEK'S PLAN for forward-looking targets.
  - Kept: TIMING block (in-progress vs complete week), WALKING IS OUT OF SCOPE rule, the continuity block referencing last week's synthesis prose.
- No data-flow or schema changes. Plan loader still returns lastWeek/thisWeek/nextWeek; index.ts still threads today + planContext. Only the prompt's framing changed.

## [3.8] — 2026-04-25 — Weekly running analysis: timing-aware, carry-over-aware, walk-free (v3.8.0)

### Garmin sync: round avg_hr/calories before upsert (v3.8.1)

Five running activities had been silently failing to upsert on every sync since the table was created. Postgres rejected the fractional `averageHR` values Garmin returns for outdoor running activities (e.g., `145.8969…`) into the `integer` column with code `22P02` ("invalid input syntax for type integer"). Walking, strength, and treadmill activities all return integer `averageHR`, which is why those upserted fine and only the 5 outdoor runs in the 20-activity window were stale. v3.7.1's per-record warning made the failure visible; v3.8.1 fixes it.

- New helper `buildActivityRecord(act)` in `src/lib/sync/garmin.ts` centralizes the type coercion. Rounds `avg_hr` and `calories` defensively (`duration_seconds` was already rounded). Replaces 4 duplicated copies of the activity-record-building code in `syncGarmin`, `syncRecentActivities`, `backfillGarmin`, and `backfillDateRange`.
- Adds the missing per-record upsert warning to the 3 sites that didn't have it (only `syncRecentActivities` had it via v3.7.1). All sync paths now log upsert failures consistently.
- Verified locally: upserting `avg_hr: 131.3` returned 400 with code `22P02`; upserting `Math.round(131.3) = 131` succeeds. Production sync after deploy confirmed all 5 previously-stale running activities updated successfully.



The weekly cardio analysis prose was over-strict during in-progress weeks: it would flag Sunday's run as "missed" while Sunday hadn't happened yet, and would treat a Monday catch-up of last week's missed Sunday session as an off-plan extra. The "How Was This Week" section also defaulted to a per-run roll-call ("the runner did X on Monday, then Y on Tuesday…") instead of leading with the sharpest takeaway. Three changes to the synthesis prompt and inputs.

- `src/lib/running-analysis/plan-loader.ts`: `loadWeekSchedule` now also returns `lastWeek: PlannedDay[]` (Mon–Sun before the analyzed week). New `WeekSchedule` shape is `{ lastWeek, thisWeek, nextWeek }`. The Supabase query already runs against `program_schedule` by date range — extending the lower bound was a one-line change.
- `src/lib/running-analysis/analysis-engine.ts`:
  - `PlanContext` now carries `lastWeek` so the LAST WEEK'S PLAN block can be embedded in the prompt as structured input. The model uses it to detect cross-week catch-ups (a run early this week whose session type was in last week's plan but apparently missed there → recognize as a legitimate carry-over, do NOT flag as off-plan).
  - `generateWeeklyAnalysis` takes a new `today` parameter (WIB date string). A TIMING block at the top of the prompt declares whether the week is COMPLETE (today > weekEnd) or IN PROGRESS with N days remaining. When in progress, the model is explicitly forbidden from flagging sessions on dates that have not occurred yet.
  - Section 1 rewritten: lead with the SHARPEST takeaway (standout session, clear progression signal, or notable gap), cite specific numbers, NOT a per-run roll-call. If the week is in progress, frame as a mid-week read.
  - Section 3 rewritten: do not flag day-of-week shifts, do not flag sessions on not-yet-occurred dates, do not flag legitimate cross-week catch-ups, and if there is genuinely nothing to flag, say so in one sentence rather than manufacturing a concern.
  - New top-level rule: WALKING IS OUT OF SCOPE. Walks are filtered out at ingestion (v3.4.0 pace > 10:00/km filter), but the prompt now also tells the model to ignore any walk-only or treadmill-walking activity if one slipped through — do not include in run count, Z2 volume, or prose.
- `src/lib/running-analysis/index.ts`: passes `today = getWibNow()` into `generateWeeklyAnalysis`, and threads `lastWeek` from the schedule loader into `PlanContext`.
- No schema change, no migration, no cost delta. Weekly insight prose updates on next regeneration (Saturday cron, or manual trigger via the Trigger Analysis button on /cardio-analysis).

## [3.7] — 2026-04-25 — Cardio Analysis: drop low-signal panels (v3.7.0)

### Run analysis: classify laps by segment type for manual-lap workflows (v3.7.2)

User started using the Garmin lap button to mark transitions inside a single run — Z2 base → press lap → tempo finish on long runs; warm-up jog → press lap → 4-min Z4 interval → press lap → 1–2 min rest → … on VO2 max sessions. The Notion per-lap table previously labeled every lap as just `lapIndex` under "Per-Km Splits" — wrong when laps are no longer ~1km. Fastest Km also didn't know to skip warm-up / cool-down / interval-rest segments. Light-touch implementation: backward compatible (uniform Z2 runs classify entirely as 'main' and render as before), no decoupling math change.

- New `SegmentType` union in `src/lib/running-analysis/garmin-enrich.ts`: `warm-up | main | tempo | interval-work | interval-rest | cool-down`. Defaults to 'main'.
- New `classifyLaps()` heuristic detection from HR + pace + duration relative to a baseline (median of middle 60% of laps). Conservative: interval detection requires ≥2 work laps with proper alternation against rest laps, so a single fast lap can't be mis-labeled. Warm-up / cool-down detection bounded to first/last laps with HR significantly below median main HR AND pace significantly slower than median.
- `src/lib/running-analysis/notion-runs-db.ts`: heading "Per-Km Splits" → "Lap Splits". First-column label now shows lap distance + segment label, e.g., `L7 · 1.00 km (tempo)` or `L4 · 0.85 km (int 2)`. Interval reps numbered in render order.
- `src/lib/running-analysis/index.ts`: Fastest Km picker excludes `warm-up`, `cool-down`, `interval-rest`; prefers ≥900 m laps but falls back to any eligible lap if none qualify. Format updated to `L7 (1.00 km) -- 7:03 /km` so non-1km segments are explicit.
- Decoupling math unchanged (its 3–5min warmup exclusion is independent and adequate). Activity-level form averages (cadence, GCT, vert ratio) still pulled from raw_json — flagged as follow-up for VO2 max sessions where they get diluted by warm-up/cool-down inside the run.
- Verified by dry-running the classifier across 6 scenarios (Apr 25 real long run, hypothetical VO2 max, long run with manual tempo press, uniform Z2, single 5km lap, accidental fast lap). Then re-rendered Apr 25 in production: classifier correctly detected the natural tempo finish on L7-L8 purely from HR + pace, no manual press needed.

### Cardio analysis: surface Garmin sync count + errors on result (v3.7.1)

The cardio page button was silently swallowing Garmin sync failures — `syncRecentActivities` errors were caught and logged to stderr but the result returned to the UI looked identical to a successful run with no new activities. This caused today's Apr 25 run to appear "missing" when in fact the sync had simply not upserted anything. The fix surfaces both the count of activities Garmin returned and the count successfully upserted to Supabase, plus pushes a descriptive entry into the existing errors[] array whenever the sync was skipped, partial, or returned 0 activities.

- `src/lib/sync/garmin.ts`: `syncRecentActivities` now returns `{ fetched, synced }` instead of just `{ synced }`. Logs both counts on entry/exit. Per-activity upsert errors also emit a `console.warn` line — directly enabled the v3.8.1 root-cause investigation an hour later.
- `src/lib/running-analysis/index.ts`: `RunningAnalysisResult` gains three fields — `garminFetched`, `garminSynced`, `garminSkipReason`. Step 0's try/catch now pushes into `errors[]` whenever the sync was skipped, partial, or returned 0 activities.
- `src/app/cardio-analysis/page.tsx`: Result panel adds a "Garmin sync" cell ("N/M upserted" or "Skipped") and renders `garminSkipReason` as a warning row when present.



Removed two panels from `/cardio-analysis` that weren't pulling their weight: "Zone distribution" (time-in-zone bars across the recent runs) and "HRV vs training load" (scatter of run days). Both surfaced data already covered better elsewhere — zone breakdowns live per-run in the runs table, and HRV trend has its own dedicated view — so the cards added visual weight without informing decisions.

- `src/app/cardio-analysis/page.tsx`: deleted the grid block holding both cards, the `zoneDistribution` and `scatterData` `useMemo` hooks that fed them, and the now-unused `recharts` import (`ScatterChart`, `Scatter`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `ZAxis`).
- Page now flows: Jarvis verdict → HR Zone Calculator → Weekly Insights → recent runs table. Tighter, less scrolling, no decision lost.
- No schema change, no API change, no cost change.

## [3.6] — 2026-04-24 — Current Events: outlet blocklist per tab (v3.6.0)

Low-value outlets (sports niches and clickbait aggregators) were showing up in the Indonesia and International feeds, consuming a slot and dragging down the average relevance of what the synthesis drew from. Added a per-tab blocklist applied at RSS ingestion time.

- `src/lib/sources/googleNewsRss.ts`: new `BLOCKED_OUTLETS` map keyed by locale. Items whose primary `source` matches are dropped entirely before ranking; related outlets matching the blocklist are scrubbed from `relatedOutlets` and do NOT count toward `outletScore` either, so the coverage signal now reflects only outlets actually worth surfacing. Matching is case-insensitive substring so variants (NBC Sport / NBC Sports, Bolasport.com / Bolasports.com) all catch.
- International blocklist: `fox sports`, `cleveland browns`, `bleeding green nation`, `nbc sport`, `phys.org`.
- Indonesia blocklist: `lentera.co`, `lenterea.co`, `qoo media`, `monitorday`, `detikhot`, `bolasport`, `asatunews.co.id`.
- Verified on the 2026-04-24 afternoon slot: Lentera.co (previously appearing in sources) filtered out, no blocked outlet names in either tab's source chip list. 32 Indonesia + 35 International items retained after filtering.
- No schema change, no cost change, no prompt change. Purely an ingestion-layer filter.

## [3.5] — 2026-04-24 — Current Events: signals line + neutral voice (v3.5.0)

Each theme in the Indonesia and International tabs now shows a quantitative signals line under its title, and the synthesis prose drops personal-relevance framing entirely.

- `src/lib/sync/newsSynthesis.ts`: new `fetchPriorThemes()` helper queries the last 6 rows of `news_synthesis`, extracts bold theme titles from `indonesia_synthesis` and `international_synthesis` columns, groups by `date + time_slot`, and injects as `<prior_themes_indonesia>` / `<prior_themes_international>` blocks in the prompt. Claude uses these to classify each new theme's recurrence deterministically against prior slots rather than guessing.
- Signals line format, emitted as the second line of every theme: `_signals: coverage N · M articles · RECURRENCE_`. `coverage N` is the highest `outletScore` among items Claude bundled into that theme — read directly from the pre-ranked list, not recounted. `M articles` is distinct RSS items bundled. `RECURRENCE` is one of `new`, `2nd slot`, `3rd slot`, `ongoing 2 days`, `ongoing 3 days`, etc., cross-referenced against the prior-themes blocks.
- Dropped Jarvis context injection from the news synthesis prompt. `buildJarvisContext({ pages: ['about_me', 'work', 'projects'] })` is no longer called here — the editorial lens (macro, policy, geopolitics, markets, business, AI/tech, science; skip human-interest/celebrity/sports) stays as a prompt-level rule but no longer carries personal priorities.
- Voice rule tightened. Explicit ban on second-person language ("you", "your", "the reader") and personal-relevance framing ("this matters for Indonesian CEOs", "implications for your business"). Prose now reads as general-publication analyst copy — describes the story and its wider-world implications, not its implications for any specific reader.
- `src/lib/renderMarkdown.ts`: new line-level rule matches `^_signals:...$_` and renders as a small muted monospace block (`text-jarvis-text-muted text-xs font-mono`), so the signals line reads as metadata under the theme title, not as prose.
- Verified: Indonesia and International tabs render signals line in UI correctly; today's lighter news day shows `coverage 1` across most themes (accurate — Google News's related-bundle is thin today); `RECURRENCE` correctly identifies stories carrying over from prior slots as "2nd slot" or "3rd slot". Build clean, no schema change, no cost delta.

## [3.4] — 2026-04-23 — Cardio analysis: Z5 calculator, walk filter, weekly-mix review (v3.4.0)

Three refinements to Cardio Analysis after v3.0.8 dropped the outdoor-only filter for treadmill runs.

- `src/components/HRZoneCalculator.tsx`: HR Zone Calculator now toggles between Zone 2 and Zone 5. Z2 view unchanged (Age, Karvonen, LTHR, Attia, Galpin Blue, MAF with highest-floor/highest-ceiling consensus band). Z5 view shows Age 90-100%, Karvonen 90-100% HRR, LTHR-based Friel Z5 (≥106%), Attia 90-100%, Coggan VO2 (110%+ LTHR), Galpin Red 90-100%. Z5 consensus band is the spread of Z5 floors across methods (min of floors to max of floors) — the useful "entry to Z5" band, since ceilings all collapse at max HR. Header copy, target label, YAxis scale, and chart domain all switch with the mode. Same `/api/cardio/hr-zones` feed powers both.
- `src/lib/running-analysis/index.ts`: added pace-based walk filter. Any activity with duration/distance implying pace slower than 10:00/km (600 sec/km) is dropped before ingestion, regardless of activity type. Catches incline-walk sessions that Garmin tags as `treadmill_running` / `indoor_running`. Outdoor runs and genuine treadmill runs are unaffected.
- `src/lib/running-analysis/analysis-engine.ts`: loosened the weekly-review prompt. The "plan adherence per date" and "continuity vs last week's focus" lenses are gone. New framing is two lenses — WEEKLY MIX (did the week deliver the planned session types and volumes as a whole?) and PROGRESSION IN CONTEXT (form/efficiency + like-for-like pace, unchanged). Explicit instruction added to NOT flag day-of-week shifts or sessions moved within the week — only flag when weekly totals are off or when a push slips into the following week. Last-week's insight is still passed in as context, but the prompt no longer grades week-over-week adherence.
- Verified: `npm run build` passes. Browser preview of `/cardio-analysis`: Z2 ↔ Z5 toggle confirmed with Z5 consensus band 167–180 bpm (lowest Z5 floor up to highest Z5 floor across methods). Backend pace filter and prompt change surface on next running-analysis cron run.

## [3.3] — 2026-04-22 — Current Events: one-story-per-paragraph rule (v3.3.0)

First-day feedback on v3.2.0: paragraphs kept bundling unrelated stories ("Russia halts Kazakh oil; Spirit Airlines rescue advances" / "Dave Mason dies; Wembanyama concussion"). The v3.2.0 prompt's "merge before pad" rule encouraged Claude to combine thinly-related headlines into a single theme on slow-news days; the result read as grab-bag lists rather than coherent theme synthesis.

- `src/lib/sync/newsSynthesis.ts`: tightened the synthesis prompt. Each theme now covers exactly ONE story or ONE tightly-related narrative arc. Explicit ban on semicolon-joined headline lists and "also story B; also story C" constructions. Two headlines without a shared cause/consequence/actor must split into separate themes (or one gets cut).
- "Padding forbidden." Rule changed from "3-5 themes, merge before pad" to "it is better to return 3 sharp themes than to pad to 5 by merging unrelated stories." Fewer themes on thin days is now the correct behavior.
- Reader-lens filter tightened: skip pure human-interest, obituaries, and sports unless they have macro or business relevance.
- Verified: Indonesia tab returned 3 clean themes (e-KTP penalty proposal, tax-filing deadline, urea export deal) — each a single coherent story. International returned 4 (Hormuz, Fed nominee, Google Workspace Intelligence + TPU, SpaceX/Cursor) — each scoped to one narrative. No more grab-bag paragraphs.

## [3.2] — 2026-04-22 — Current Events: Indonesia + International tabs (v3.2.0)

The Current Events card now has three tabs — Email, Indonesia, International — instead of one newsletter-only synthesis. Indonesia and International streams are pulled from Google News RSS (localized feeds: `hl=id&gl=ID` for Indonesia, `hl=en-US&gl=US` for International) with no API key, no crawling, and strong native-outlet coverage on the Indonesia side (Kompas, Detik, CNBC Indonesia, Liputan6, Antara, Bisnis, Databoks, Hukumonline, etc.).

- New `supabase/migration-025-news-tabs.sql`: adds `indonesia_synthesis`, `international_synthesis`, `*_sources`, `*_article_count` columns to `news_synthesis`. Additive-only, backward-compatible. Applied via Supabase MCP.
- New `src/lib/sources/googleNewsRss.ts`: thin RSS fetcher + pre-ranker. Each item is scored by outlet-count (number of unique outlets Google News bundles as covering the same story), with `pubDate` as tiebreaker. Claude sees the pre-ranked list, so theme selection is not left to pure prompt judgment.
- `src/lib/sync/newsSynthesis.ts`: single Claude call now emits all three tab syntheses in tagged sections (`<<<EMAIL>>>`, `<<<INDONESIA>>>`, `<<<INTERNATIONAL>>>`). Prompt locks in top-down / BLUF paragraph style (one flowing 4-7 sentence paragraph per theme, no sub-bullets, no "Why it matters" label), analyst-brief voice, 3-5 themes per tab with "merge before pad" on thin news days. Jarvis context (`about_me`, `work`, `projects`) injected so themes weight against Filman's priorities. No cross-slot dedupe — developing stories keep surfacing.
- `src/app/api/news/route.ts`: response shape extended with `latest.tabs.{email,indonesia,international}`. Legacy top-level fields preserved for any older client caches.
- `src/components/NewsCard.tsx`: tabbed UI. Default tab picks the first non-empty among Email / Indonesia / International. Source chips render under the tab bar. Older slots accordion shows the active-tab content for each historical slot.
- Cost: ~$0.04 per synthesis (Sonnet 4.5, ~2000 in + 2000 out), ~$3.50/month at 3 slots/day. Latency ~10s.
- Verified end-to-end: cron trigger produced 38 Indonesia + 38 International items, 22 + 19 unique outlets per tab, multi-paragraph synthesis clean. UI verified in browser preview with all three tabs clicking through correctly.

## [3.1] — 2026-04-22 — Enable RLS on email_draft_blocklist (v3.1.0)

Supabase security advisor flagged `public.email_draft_blocklist` as CRITICAL (`rls_disabled_in_public`) — anyone with the project URL + anon key could read/write the table. The app only touches this table via the service-role key (which bypasses RLS), so enabling RLS with no policy closes the hole without any app-code change.

- New migration `supabase/migration-024-enable-rls-email-draft-blocklist.sql`: `ALTER TABLE email_draft_blocklist ENABLE ROW LEVEL SECURITY;` Applied to production Supabase via MCP.
- Post-fix advisor check: the table dropped from ERROR (`rls_disabled_in_public`) to INFO (`rls_enabled_no_policy`) — same acceptable pattern already used by `cron_run_log`.
- Follow-up flagged in BACKLOG: ~25 other tables still carry permissive `FOR ALL USING (true)` policies (WARN level). App doesn't need them; a defense-in-depth cleanup pass could drop them entirely.

## [3.0] — 2026-04-20 — "Atmosphere"

Complete UI migration from v2 (dark, arc-reactor) to v3.0 "Atmosphere" — light-primary cinematic, periwinkle ambient, neon green reserved only for liveness. Shipped via three parallel streams behind a shared foundation commit. No API, Supabase, auth, or cron changes across the whole migration.

### Foundation & shell (Stream 1)
- `src/app/globals.css`: new Atmosphere token set — surfaces (`#f7f8fc` canvas, `#ffffff` card, `#fafbff` elevated, `#ecedf5` deep), borders, ink hierarchy (`--color-jarvis-text-primary/-dim/-faint`), hybrid accents (`--color-jarvis-cta` blue / `-ambient` periwinkle / `-aurora` magenta / `-live` neon). Legacy v2 tokens kept as aliases during migration; will retire in a follow-up cleanup.
- `src/app/layout.tsx`: register Space Grotesk + Inter + JetBrains Mono via `next/font/google` as CSS variables. Drop permanent `dark` class.
- `src/components/Mindmap.tsx` (new): canvas brand glyph — Fibonacci-sphere node layout, depth-sorted edges, pulse firing proportional to state. Props `size`, `state` (`idle | thinking | speaking | listening`), `density`. Honors `prefers-reduced-motion` by freezing at idle snapshot.
- `src/components/Sidebar.tsx`: rewrite as collapsible 72px → 240px on hover/pin (localStorage `jarvis.sidebar.pinned`). Static brand-mark SVG (7-neuron snapshot + radial gradient) + JARVIS wordmark. Seven routes: dashboard, briefing, health, cardio, email, contacts, utilities.
- `src/components/TopBar.tsx`: rewrite — 36px animated Mindmap glyph + WIB greeting + ⌘K trigger + tokenized Online pill (the one sanctioned `--color-jarvis-live` use) + ambient-soft mic button.
- `src/components/CommandPalette.tsx` (new): global `⌘K` / `Ctrl+K` shortcut, backdrop-blur overlay, grouped results (Actions / Jump to / Suggestions), integrated Web Speech API voice input, `↑↓ / ↵ / Esc` keyboard nav. Replaces the floating `VoiceMic` mount for desktop flows.
- Split `BriefingCard.tsx` into `BriefingHero.tsx` (dashboard hero with 180px Mindmap + CTA + ghost "Read transcript" + duration meta) and `BriefingOverlay.tsx` (full-viewport cinematic portal: 560px mindmap stage, transcript rail with past/current/upcoming fades, scrubber, chapter list; reuses `SpeakingContext` for TTS).
- `AppShell.tsx`: mounts Sidebar + TopBar + CommandPalette. Removed `SpeakingOverlay` mount.
- Deleted `src/components/SpeakingOverlay.tsx` (replaced by `BriefingOverlay`).
- Archived `/brand`, `/style-tile`, `/mood` + `ArcReactor.tsx` to `src/_archive/` (tsconfig-excluded).

### Health & Cardio (Stream 2)
- `/health`: readiness-narrative hero + 3-col health metric grid + OKR ridgeline + blood-work panel per spec §8.3.
- `/cardio-analysis`: zone distribution as stacked horizontal bar in ambient colors, HRV-vs-load scatter, Jarvis verdict card. Tokenized hardcoded Recharts hex values.
- `src/components/health/OkrCard.tsx`: rewritten as the **OKR Ridgeline** canvas (5 objectives × 14-day history, periwinkle gradient fills, JetBrains Mono axis labels) per spec §8.1. Ported `drawRidgeline` from the design-system prototype.
- `src/components/health/HealthInsights.tsx`: added narrative-annotation slot per §8.3. Accepts narrative as a prop; generator endpoint `POST /api/health/narrate` is backlogged.

### Email / Contacts / Utilities (Stream 3)
- `/emails`: 400px list + detail split-pane per app.html `.email-grid`. Tabs for Needs response / Other / Blocked; blocklist moved out of collapsible into its own tab.
- `src/components/EmailThread.tsx` (new): sender-grouped thread card with inline draft bubble, tone picker (Direct / Warm / Brief), and Send as-is / Edit draft actions that deep-link to the Gmail/Outlook drafts folder. Tone switching is cosmetic pending a regeneration endpoint (backlogged).
- `EmailCard` (dashboard): compact "Needs response" preview grouped by sender, linking to `/emails`. Drops the synthesis-prose accordion.
- `/contacts`: 2-col card grid with gradient avatars, 12-week touch-history bar chart, italic ambient Jarvis suggestion ("Last seen N days ago. Light follow-up may be timely."). Filter chips (All / Pending / In Notion / Ignored) replace the table-heavy layout.
- `/utilities`: 2-col connector cards + recent cron-run log table (sourced from existing `/api/cron/status`). Status lights use semantic tokens (good / warn / danger) — no neon in this scope.

### Discipline
- Neon-green audit: 0 hits across all three streams' scope.
- All three streams merged with zero file-level conflicts (disjoint scope design).
- `npm run build` clean after each merge.

### Follow-ups (same-version bugfixes, no bump)
- `BriefingOverlay.tsx`: playback rewritten to mirror `TTSButton.tsx`'s robust pattern — fetch-as-blob for the stored Supabase Storage URL instead of binding it directly as `audio.src`, `playsinline` + `preload='auto'` + wait for `canplaythrough` (5s fallback), AbortController, 20s timeout, and Web Speech fallback if both stored-audio and `/api/tts` fail. Play button now shows a loading spinner while fetching/buffering. Fixes the "can't play the briefing" regression from the initial v3.0 ship.
- `TopBar.tsx`, `Sidebar.tsx`: version chip is now visible in the UI again. TopBar renders a `v{VERSION.display}` pill next to the greeting; Sidebar appends it inline after the `JARVIS` wordmark (visible when expanded/pinned).
- `BriefingHero.tsx`: preview subtitle no longer shows literal `**Calendar Overview**...`. New `getPreview()` helper skips leading heading-only paragraphs and strips inline `**bold**` markers so the subtitle reads as clean prose, not raw markdown.
- `src/app/page.tsx` dashboard: wrapped all children in a single `space-y-5` stack so `BriefingHero` and `KpiRow` are no longer flush; replaces the earlier ad-hoc `mt-5` wrappers on the grid and email/news/fitness blocks.

### Restore granular OKR objective cards (v3.0.6) — 2026-04-20
- `src/components/health/OkrCard.tsx`: reverted from the single canvas ridgeline back to the pre-v3.0.2 per-objective card — each OKR renders its own card with KR rows showing current vs target, progress bar, status badge (on track / behind / off track / no data), baseline, context, and trend arrow with delta. The ridgeline's 14-day trajectory was synthesized client-side (no real history endpoint), which lost the per-KR granularity that drives daily decisions. Filman: "OKR Ridgeline doesn't work for me — need to shift to previous version with more granular insights."
- `src/app/health/page.tsx`: `<OkrCard />` now renders per-objective again (O1–O4 in a 2-col grid, BloodWorkPanel between, O5 full-width at the bottom). Dropped the `synthHistory` helper and the `RidgelineObjective` adapter. The v3 Atmosphere shell is preserved — narrative-readiness hero, 3-col health-grid headline metrics, blood-work panel, `HealthInsights` with narrative prop.

### Char-weighted briefing subtitle pacing (v3.0.5) — 2026-04-20
- `BriefingOverlay`: the current-line subtitle was advancing faster than the ElevenLabs voice because each line got an equal `1 / lines.length` share of the timeline regardless of length. Short lines raced ahead; long lines under-held.
- Replaced with a cumulative-char weighting: precompute `cumChars[]` where `cumChars[i] = sum(lines[0..i).length)`, then on each `ontimeupdate` compute `progressChars = (currentTime / duration) * totalChars` and pick the largest `i` with `cumChars[i] <= progressChars`. ElevenLabs render time is roughly linear in char count, so subtitle now tracks voice pacing within a beat.
- Scrubbing still snaps correctly — the range input writes `audio.currentTime`, and the next `ontimeupdate` re-derives `lineIdx` from the new position.

### Shared briefing text helpers + server-side voiceover sanitize (v3.0.4) — 2026-04-20
- New `src/lib/briefingText.ts`: `sanitizeBriefing()` (strips `**bold**`, `*italic*`, `# heading`, bullet / numbered markers, `[SCHEDULE]`-style written-briefing section markers, and drops heading-only short lines), `splitBriefingLines()`, and `briefingPreview()`.
- `BriefingOverlay` and `BriefingHero` now import the shared helpers. Drops the local `sanitizeForSpeech` / `splitLines` / `getPreview` duplicates so the two components can't drift again.
- `/api/briefing/regenerate`: the voiceover half of the prompt now explicitly forbids markdown, bullets, numbered lists, and `[SECTION]` markers. Server also runs the Claude voiceover output through `sanitizeBriefing` before storing to `briefing_cache.voiceover_text` and before calling `generateAndStoreAudio()` — so ElevenLabs never reads stray markers aloud, and fresh briefings never ship dirty text to the client. The client-side sanitize stays as defense-in-depth for historical rows.

### Dashboard email synthesis restored (v3.0.3) — 2026-04-20
- `src/components/EmailSynthesisCard.tsx` (new): fetches `/api/emails`, renders the Claude-generated email synthesis prose via `renderMarkdown`, shows the latest slot label + important/deadline counts in the header, collapses earlier same-day slots behind a toggle. Matches v3.0 card styling (`rounded-[14px]`, `jarvis-border`, `bg-jarvis-bg-card`).
- `src/app/page.tsx` dashboard: `EmailSynthesisCard` (left) and `EmailCard` (right) now sit in a `grid-cols-1 lg:grid-cols-2` block below the schedule/tasks row — synthesis overview on the left, actionable "Needs response" list on the right. Mobile stacks them. Restores the email synthesis that the initial v3.0 migration had dropped from the dashboard in favor of the compact triage preview alone.

### Briefing readability + preload (v3.0.2) — 2026-04-20
- `BriefingOverlay`: strip markdown (`**bold**`, `*italic*`, `# heading`, `- ` and `1. ` list markers) from both the voiceover and briefing source before `splitLines`. Drop heading-only short lines (2–4 words, no sentence punctuation) so section labels like "Calendar Overview" don't appear as their own subtitle beat.
- Drop the full `01…NN` transcript rail. Keep a single centered subtitle — current line in 26–32px display type, with a faint next-line preview underneath.
- Preload audio the moment the overlay opens. New effect chains fetch → attach `<audio>` → wait for `canplay` (5s cap) → `status='ready'`. Play button is now instant; `onplay` / `onpause` drive status, so tapping pause/resume doesn't re-fetch.
- Scrubber is now a seekable `<input type="range">` bound to `audio.currentTime`. Fully seekable once the blob is in memory.
- Mindmap stage trimmed 560 → 480px to give the new subtitle vertical air above it.

### Mobile polish (v3.0.1) — 2026-04-20
- `AppShell`: mobile-aware sidebar drawer state + reduced gutter padding (`px-4 sm:px-6 md:px-8`).
- `Sidebar`: below `md:` hides by default and slides in as a fixed 240px drawer with backdrop when `mobileOpen`. Labels force-visible during drawer mode; drawer auto-closes on route change.
- `TopBar`: hamburger visible below `md:`, greeting date/time hides below `sm:`, ⌘K search collapses to icon-only below `md:`.
- `/emails`: removed the hardcoded `400px 1fr` split. Mobile uses single-pane master-detail — list hides when a row is selected; detail shows a "Back to list" button. Dropped the auto-pick-first-row effect so the list is what loads on mobile.
- `/utilities` cron log: stacks to a 2-line card layout below `md:` (Job + status, Last run · Duration). Desktop keeps the 4-column grid.
- `/utilities` API usage table: hides Tokens in / Tokens out / Chars columns below `sm:`; keeps Service / Calls / Cost.
- `BriefingOverlay`: padding reduced from `px-8 py-16` to `px-4 py-8 sm:px-8 sm:py-16`.
- `/health` readiness hero: `text-[56px] sm:text-[72px]`, `p-5 sm:p-7`, `gap-5 md:gap-8`.
- `/cardio-analysis` zone distribution: dropped fixed `60px 1fr 80px` inline columns; uses `grid-cols-[auto_1fr_auto]` so narrow labels don't crush the bar.
- `VERSION.display` now consumed by the UI chips (was still reading `VERSION.string` pre-merge).
- `package.json` bumped to `3.0.1` (full semver, per updated CLAUDE.md split — UI still displays `v3.0`).

## [2.4.48] — 2026-04-20

### Added
- `/emails` breadcrumb now shows "Updated HH:MM WIB" from the most recent `email_triage.created_at`, giving a visible freshness signal (previously only a coarse Morning/Afternoon/Evening slot was derived internally, never rendered).
- `/contacts` header now shows "Last refreshed YYYY-MM-DD HH:MM WIB" from `max(scanned_contacts.updated_at)`. Scans can be days apart, so the date matters — the page previously had no way to tell whether the list reflected a fresh scan.
- API: `/api/emails/triage` and `/api/contacts` each return a new `lastRefreshedAt` ISO field (nullable). No schema changes.

## [2.4.47] — 2026-04-20

### Added
- HR Zone 2 calculator now tracks Garmin's actual LTHR. Daily Garmin sync calls `getUserSettings()` and stores `userData.lactateThresholdHeartRate` in a new `garmin_daily.lthr` column (migration-023). `/api/cardio/hr-zones` returns the latest non-null value (falls back to 164 only if empty). Resting HR is already the 4-week rolling average from `garmin_daily.resting_hr` — no change. Verified: today's row populated with LTHR 166.

## [2.4.46] — 2026-04-19

### Fixed
- OKR card now surfaces legacy `health_measurements` rows saved under older `measurement_type` names (`dead_hang`, `ohs_major_compensations`, `waist_circumference`, `blood_pressure_systolic`, `blood_pressure_diastolic`). The v2.4.45 fix made the read use the canonical OKR `key_result` directly, which orphaned historical data (e.g. the OHS "2 counts" reading). `/api/health-fitness/okr` now canonicalizes `measurement_type` into the OKR `key_result` when building the latest/previous maps, so old and new rows collapse into the same bucket.

## [2.4.45] — 2026-04-19

### Fixed
- `/api/health-fitness/okr` now reads manually-entered `dead_hang_seconds` and `overhead_squat_compensations` rows correctly. The `typeMap` remapped those OKR keys to `'dead_hang'` / `'ohs_major_compensations'`, but `/api/health/measurements` only accepts (and stores) the long names — so values saved from the `/health` manual entry form never surfaced on the OKR card. Dropped the two bogus mappings; kept the legitimate `waist_cm` / `bp_*` → long-name translations.

## [2.4.44] — 2026-04-19

### Fixed
- Manual Entry form on `/health` page no longer returns 405. `ManualEntryForm.handleMeasurement` was pre-flighting the POST endpoint with an unnecessary GET to `/api/health/measurements`; the route only exports POST, so Next.js returned 405 and `fetchAuth` threw before the actual save ever ran. Removed the stray GET (and the now-unused `fetchAuth` import).

## [2.4.43] — 2026-04-18

### Changed
- Weekly cardio synthesis is now plan-aware and continuity-aware. `generateWeeklyAnalysis()` takes two new inputs: last week's `WeeklyInsight` (for continuity with the prior `Focus Next Week`) and a `PlanContext` (this-week + next-week rows from Supabase `program_schedule`, plus the `# 5. Cardio protocol` slice from the Transformation program Notion page for Z2/tempo/VO2 HR semantics).
- The prompt now judges each run on three lenses — plan adherence (session type + duration vs the planned entry for that date), continuity (executing last week's focus), and progression-in-context (form/efficiency trends + like-for-like pace by session type). Raw weekly average pace is no longer compared across mixed session types, so intentional Z2 slowdowns are no longer flagged as regression.
- Added `src/lib/running-analysis/plan-loader.ts` with `loadWeekSchedule()`, `loadCardioProtocol()`, and `loadPreviousWeekInsight()`. The Notion cardio-protocol fetch is memoized per day.

## [2.4.42] — 2026-04-18

### Fixed
- Email Synthesis and Running Analysis no longer report as "Failed (timeout 30s)" on cron-job.org. Both routes now return 202 immediately and run the heavy work via Next.js `after()`, so the cron-job.org dashboard reflects actual outcome via `cron_run_log` instead of HTTP timeouts.

### Changed
- Added `runCronJob()` helper in `src/lib/cronLog.ts` that unifies `markSynced()` + `logCronRun()` in a single wrapper.
- Refactored cron routes to use the helper: `contact-scan`, `fitness`, `morning-briefing`, `news-synthesis`, `notion-context`, `email-synthesis`, `running-analysis`.
- Added `logCronRun()` coverage to `garmin` (all three branches) and `notion-context` (previously had no sync tracking at all). All 11 cron-job.org jobs now write an audit row to `cron_run_log`.

## [2.4.39] — 2026-04-18 (Sprint 14)

### Added
- Email draft blocklist (DB-backed): classified need_response emails whose senders match a blocklist pattern are still shown in the "Needs Response" section but skip draft generation. Prevents wasted Claude tokens on action-button emails (Kantorku HRIS approvals, reimbursement notifications).
- `/emails` page: collapsible "Draft Blocklist" section with add/remove and amber "skipped — pattern" indicator on blocked rows.
- `/api/emails/blocklist`: GET/POST/DELETE CRUD.
- `scripts/seed-kantorku-blocklist.mjs`: audits last 7 days for Kantorku senders and seeds the initial pattern.
- Migration 021: `email_draft_blocklist` table + `draft_skipped_reason` column on `email_triage`.

## [2.4.7] — 2026-03-29 (Sprint 14)

### Changed
- Fitness sync rewritten: reads from Supabase `program_schedule` table instead of Notion API — faster, simpler, no external API dependency

### Fixed
- Fitness program schedule: corrected 345 Notion database entries (day numbering off by +7 after Day 49, all Wed/Sat cardio stored as "walk" instead of "run")

### Added
- `program_schedule` table in Supabase (364 rows) as single source of truth for daily fitness program data
- `scripts/fix-fitness-schedule.mjs` — one-time Notion database correction script

## [2.1.4] — 2026-03-21 (Sprint 12)

### Changed
- Synthesis writing style: all prompts (briefing, email, news) now use markdown with **bold** section labels, bullet points, and numbered lists
- News synthesis: stories cross-referenced across all emails with multi-source attribution (e.g. Bloomberg, NYT)
- News synthesis: narrowed sources to Bloomberg and NYT only, removed tier system
- News synthesis: removed voiceover section

### Added
- Shared `renderMarkdown` helper (`src/lib/renderMarkdown.ts`) for consistent markdown-to-HTML across all synthesis cards

### Fixed
- Markdown not rendering in EmailCard (was plain text), BriefingCard and NewsCard (partial regex only)
- Morning briefing cron timeout: TTS audio generation now runs in background (fire-and-forget) so response returns within 30s

## [1.7.0] — 2026-03-19 (Sprint 7)

### Added
- Health & Fitness OKR dashboard (`/health`) tracking 5 objectives from Notion
- Apple Health webhook expansion for body fat, waist, BP, lean body mass
- Blood work tracking with reference range indicators
- Utilities page (`/utilities`) with integration health and API cost tracking
- Per-service API usage tracking (Claude tokens, ElevenLabs chars, etc.)
- ElevenLabs → OpenAI TTS auto-failover on credit exhaustion
- 56-day data retention for Garmin daily, activities, weight, and health measurements
- Delta briefing (mid-day change summary)
- Fitness sync cron job
- Live WIB date/time display in TopBar
- Versioning system with prominent pill badge display
- Navigation between Dashboard, Health, and Utilities pages

### Fixed
- Fitness extraction accuracy (week 13 vs week 8 bug)
- Garmin cron 500 error

### Changed
- Voiceover persona refined to Alfred/British butler style
- Version format: `{major}.{sprint}.{iteration}`

## [1.6.0] — 2026-03-18 (Sprint 6)

### Added
- ElevenLabs TTS integration with dual voice toggle (Paul/Morgan)
- Streaming audio playback for reduced latency
- Dual-script generation (written briefing + voiceover script)
- 6 transformation intelligence features (change detection, phase-aware briefing, workout adherence, milestone tracker, recovery alerts, biweekly check-ins)
- Task blacklist filter and Notion stale task cleanup

### Fixed
- Voice cutoff after first sentence (collect all chunks before playing)
- Markdown rendering in briefing/email cards

## [1.5.0] — Sprint 5

### Added
- Garmin Connect integration (daily health metrics + activities)
- Weight tracking via Apple Health webhook
- Fitness context sync from Notion transformation program
- Health and Fitness domain KPIs auto-populated from Garmin

## [1.4.0] — Sprint 4

### Added
- Microsoft Outlook calendar and mail integration
- Email synthesis with Claude summarization
- Voice input with intent parsing

## [1.3.0] — Sprint 3

### Added
- Google Calendar and Gmail integration
- Morning briefing generation with Claude
- Notion tasks sync

## [1.2.0] — Sprint 2

### Added
- Dashboard UI with domain health indicators
- Sidebar with life domains and health ring
- KPI tracking system

## [1.1.0] — Sprint 1

### Added
- Initial project setup (Next.js + Supabase)
- Authentication system (cookie + cron secret)
- Core database schema

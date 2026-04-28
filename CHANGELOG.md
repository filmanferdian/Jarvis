# Changelog

All notable changes to Jarvis are documented here.

Format: `{major}.{minor}` — from v3.0 onward we version by minor only (3.0, 3.1, 3.2…), not by patch.

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

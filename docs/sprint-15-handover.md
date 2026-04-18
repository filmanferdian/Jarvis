# Sprint 15 Handover

## Sprint 14 Summary (v2.4.1)

Sprint 14 delivered the Running Analysis automation: a full pipeline from Garmin → Notion Runs DB → Weekly Insights DB → Running Log dashboard, triggered every Saturday at 12pm WIB. Includes manual trigger UI, Claude-powered 4-section weekly analysis, and historical backfill for all 8 existing runs.

### Current State
- **Version:** v2.4.1 deployed on Railway
- **Running Analysis page:** `/running-analysis` — sidebar nav item, manual trigger with date/flags, pipeline status
- **Cron:** Saturday 05:00 UTC (`GET /api/cron/running-analysis`, `x-cron-secret` header)
- **Weekly Insights DB:** Auto-created under Running Log in Notion, 6 entries (Feb 4 – Mar 28)
- **Runs DB:** 8 entries, fully enriched (splits, weather, perf condition, decoupling, HR zones)
- **All Sprint 13 systems unchanged:** Security hardening, 10k detection, blood work UI, speaking overlay

### New Files in Sprint 14

**Core lib (`src/lib/running-analysis/`):**
- `index.ts` — Orchestrator: Supabase query → redundancy check → Garmin enrich → Notion write → Claude analysis → insights DB → dashboard
- `garmin-enrich.ts` — Fetches splits, weather, details from Garmin API; calculates decoupling + perf condition
- `notion-runs-db.ts` — Redundancy check by Garmin ID, creates Runs DB pages with all properties + block content
- `analysis-engine.ts` — Claude Sonnet 4-section weekly analysis with historical context
- `weekly-insights-db.ts` — Auto-creates + upserts to Weekly Insights Notion DB
- `dashboard-update.ts` — Patches subtitle and analysis blocks on Running Log page

**API routes:**
- `src/app/api/running-analysis/route.ts` — POST (manual trigger) + GET (status)
- `src/app/api/cron/running-analysis/route.ts` — GET cron endpoint

**UI:**
- `src/app/running-analysis/page.tsx` — Control panel page

**Modified:**
- `src/components/Sidebar.tsx` — Added Running Analysis nav item
- `src/lib/sync/garmin.ts` — Exported `createGarminClient`

### New Cron Jobs
| Job | URL | Schedule (UTC) | Header |
|-----|-----|----------------|--------|
| Running Analysis | `/api/cron/running-analysis` | Saturday 05:00 | x-cron-secret |

### No New Env Vars
### No New Migrations

### Key Gotchas
1. **Notion DB IDs ≠ MCP data_source_ids** — The MCP tool uses internal `collection://` UUIDs. Actual REST API IDs must be found via `POST /v1/search`. Runs DB: `061105bb-bd86-464b-b344-c86d89c771ca`, Running Log: `32bc674a-ecec-81c8-81c0-dff36e8d4538`.
2. **Weekly Insights DB ID cached in sync_status** — Key: `running-weekly-insights-db-id`, value in `last_error` field (same pattern as garmin-tokens).
3. **force_resync does NOT bypass redundancy check** — It re-ingests from Garmin even if the Garmin ID exists in Notion. Fixed in v2.4.1; use only when Garmin data has changed.
4. **Cadence in raw_json is half-cadence** — `averageRunningCadenceInStepsPerMinute` is per-foot; doubled in extractRunActivity to get total spm.
5. **analysis_only flag for pre-Garmin-sync weeks** — Weeks before Mar 16 have no garmin_activities in Supabase. Use `analysis_only: true` to generate insights from existing Notion data only.
6. **Dashboard update is pattern-match based** — If Running Log page structure changes significantly, the block patcher may miss. Check `dashboardUpdated: false` in results.

## Sprint 15 Deliverables

### Blood Work Integration (v2.4.8, 2026-04-01)

**Problem:** 27 blood work markers from Prodia Bona Indah (Apr 1 draw) were inserted into Supabase `blood_work` table via Claude Chat, but none showed in Jarvis due to three issues:
1. No GET endpoint — health page fetched `/api/health-fitness/blood-work` but the route didn't exist
2. Marker name mismatch — OKR targets use snake_case keys (`hba1c`, `fasting_glucose`) but DB has Prodia lab names (`HbA1c`, `Glukosa Puasa`)
3. O4 rendered as a separate custom panel instead of a standard OkrCard

**Changes:**

| File | Change |
|------|--------|
| `src/app/api/health-fitness/blood-work/route.ts` | **New.** GET endpoint returning all blood work entries ordered by test_date DESC |
| `src/app/api/health-fitness/okr/route.ts` | Added `bloodWorkNameMap` in `resolveCurrentValue()` to translate OKR key_result → DB marker_name |
| `src/app/health/page.tsx` | O4 now renders as standard OkrCard (removed O4 filter). O5 positioned after collapsible blood panel. |
| `src/components/health/BloodWorkPanel.tsx` | Rewritten as collapsible "Full Blood Panel" detail — 27 markers grouped into 7 categories (Lipid, Ratios, Metabolic, Liver, Kidney, Inflammation, CBC) |
| `package.json` | Version bump 2.4.7 → 2.4.8 |

**Data changes (Supabase, not via migration):**
- `okr_targets` baseline_value set for 4 markers: HbA1c=5.4, fasting_glucose=94, triglycerides=108, hdl=57

**Marker name mapping:**
| OKR key_result | DB marker_name |
|----------------|---------------|
| hba1c | HbA1c |
| fasting_glucose | Glukosa Puasa |
| triglycerides | Trigliserida |
| hdl | HDL |
| testosterone | Testosterone |

**Result:** OKR overall score jumped 35% → 44%. O4 shows 43% (HDL, HbA1c, TG on track; glucose off track at 94 vs target 90).

### RLS Security Fix (v2.4.9, 2026-04-01)

**Problem:** Supabase flagged a critical security issue — 4 tables had Row-Level Security disabled, making them publicly accessible via the anon key.

**Tables fixed:** `notion_context`, `briefing_deltas`, `email_triage`, `program_schedule`

**Changes:**

| File | Change |
|------|--------|
| `supabase/migration-018-enable-rls.sql` | **New.** Enables RLS + permissive policy on all 4 tables |
| `package.json` | Version bump 2.4.8 → 2.4.9 |

**Notes:**
- App uses `service_role` key which bypasses RLS, so no functional impact
- This is defense-in-depth to prevent accidental exposure via anon key
- Migration applied directly to production via Supabase SQL Editor

### Key Gotchas
1. **Prodia lab names ≠ English marker names** — The `bloodWorkNameMap` in the OKR route must be updated if new markers are added with different naming conventions.
2. **Baselines set via direct SQL, not migration** — The 4 baseline values were UPDATEd directly in Supabase. Future blood draws will show progress against these Apr 1 baselines.
3. **BloodWorkPanel categories are hardcoded** — The 7 category groups in `BloodWorkPanel.tsx` match the Prodia HL II panel. Markers not in any category fall into "Other".
4. **Testosterone and BP have no data yet** — These show as "No data" in the O4 card. Testosterone baseline will be set when first test result is available.

### Contact Ignore Feature (v2.4.11, 2026-04-05)

**Problem:** Contacts scanned from calendar invites that the user doesn't want to sync to Notion (recruiters, one-off attendees, bots) sit in the Pending Triage list indefinitely with no way to dismiss them. Re-scanning brings them back every time.

**Changes:**

| File | Change |
|------|--------|
| `supabase/migration-018-contacts-ignored-status.sql` | **New.** Adds `'ignored'` to `scanned_contacts.status` CHECK constraint |
| `src/app/api/contacts/ignore/route.ts` | **New.** POST (ignore selected emails) + DELETE (restore single email) |
| `src/app/api/contacts/route.ts` | `filter=all` now excludes ignored contacts; added `filter=ignored` |
| `src/lib/sync/contactScan.ts` | Scan skips contacts with `status='ignored'` — won't overwrite back to `'new'` |
| `src/app/contacts/page.tsx` | Ignore button in triage, collapsible Ignored section with Restore action |
| `package.json` | Version bump 2.4.8 → 2.4.11 (2.4.9–2.4.10 used by other sessions) |

**Status lifecycle update:**
```
new → ignored (via Ignore button)
ignored → new (via Restore button)
ignored contacts skipped entirely during scan
```

### Key Gotchas
1. **Migration numbering** — Migration 018 in the SQL file adds ignored status. A separate migration 018 was applied earlier for RLS (see Sprint logs). Both applied successfully but naming may confuse. Check Supabase migration history if in doubt.
2. **Default filter excludes ignored** — `GET /api/contacts?filter=all` uses `.neq('status', 'ignored')`. To see ignored contacts, use `filter=ignored` explicitly.

## Sprint 15 Remaining Candidates

### P0 — Carry-Forward
1. **Verify current events synthesis quality** — check newsletter distillation over real data
2. ~~**OKR baselines remaining**~~ — ✅ Done for blood work (4 of 6). BP and testosterone still pending data.

### P1 — Running Analysis Enhancements
3. **Trend sparklines for running** — 7-day pace, HR, distance charts on the Running Analysis page
4. **Backfill missing Garmin enrichment** — Feb 4 – Mar 22 runs in Notion have no weather/splits/decoupling

### P1 — Health & Fitness
5. **Trend sparkline charts** — 7-day mini charts for each OKR metric on `/health` page (deferred from Sprint 13)
6. **Garmin sync health visibility** — surface circuit breaker state, last sync time, API budget remaining

### P2 — Polish
7. **Security monitoring dashboard** — show rate limit hits, auth failures in `/utilities`
8. **Mobile dashboard layout** — optimize card grid for small screens

---

## Ship: v2.4.13 — Integration Health + Utilities Improvements (2026-04-06)

**Commit:** `4b714e2` on `claude/condescending-jang`, merged to `main`

### What Changed

**Integration Health — Fix 4 Red Integrations:**
- Added `markSynced()` + `logCronRun()` to `google-calendar`, `outlook-calendar`, and `notion-tasks` cron routes. These were running fine but never updating `sync_status`, so the health dashboard showed them as stale for 11 days.
- Filtered `running-weekly-insights-db-id` from the health dashboard (internal cache entry, not a real integration).

**Integration Health — UI Improvements:**
- Added a description metadata registry for all 11 integrations with proper display names.
- Added hover tooltips (CSS `group-hover`) showing each integration's description.

**API Usage — Cost Tracking Improvements:**
- Filtered free services (Garmin, Google, Microsoft, Notion) from the API usage table — only Claude, OpenAI, ElevenLabs now shown.
- Added previous month cost comparison: usage API now returns `prev_month` data, frontend shows current vs previous month side-by-side in the cost estimate card.
- Railway billing reclassified from fixed to usage-based ($5/mo base).

### Files Modified
- `src/app/api/cron/google-calendar/route.ts` — markSynced + logCronRun
- `src/app/api/cron/outlook-calendar/route.ts` — markSynced + logCronRun
- `src/app/api/cron/notion-tasks/route.ts` — markSynced + logCronRun
- `src/app/api/utilities/integrations/route.ts` — descriptions, internal filter
- `src/app/api/utilities/usage/route.ts` — free service filter, prev month, Railway usage-based
- `src/app/utilities/page.tsx` — tooltips, prev month cost card

### Gotchas for Next Session
- The 3 fixed cron routes will show green on the health dashboard after their next cron-job.org trigger (not immediately).
- Railway cost is now shown as usage-based ($5/mo base minimum). Actual billing may exceed $5 in heavy months.
- ElevenLabs quota bar now pulls live data from their `/v1/user/subscription` API (credits used, limit, reset date). No longer relies on local character count which was inaccurate.
- **Google OAuth expired** for `filmanferdian@gmail.com` and `filmanferdian21@gmail.com`. Re-auth via: `https://jarvis-production-9aea.up.railway.app/api/auth/google` (visit twice, pick each account).

---

## Ship: v2.4.14 — Health OKR Data Scope Dates (2026-04-06)

**Commit:** `acd4063` on `claude/youthful-bardeen`, merged to `main`

### What Changed

**Problem:** Health OKR cards showed metric values (e.g., "Waist: 118 cm") with no indication of when the data was captured or what date range an average covers. Made it impossible to assess data freshness.

**Solution:** Every OKR key result now displays a date-scoped context string below the progress bar:

| Metric Type | Context Format | Example |
|---|---|---|
| 7-day averaged Garmin (HR, steps, sleep, stress, body battery) | `7d avg: DD Mon – DD Mon` | `7d avg: 30 Mar – 5 Apr` |
| Single health measurements (waist, body fat, dead hang, OHS, BP) | `Measured DD Mon` | `Measured 29 Mar` |
| Blood work (HbA1c, glucose, triglycerides, HDL) | `Lab DD Mon` | `Lab 1 Apr` |
| Weight | `Weighed DD Mon` | `Weighed 6 Apr` |
| Stable Garmin (VO2 max, fitness age) | `As of DD Mon` | `As of 6 Apr` |
| Training completion | `Last 7 days: X/4 sessions` | `Last 7 days: 0/4 sessions` |
| HRV decline | Unchanged (already had week-over-week context) | `Prev week: 45 ms → This week: 42 ms` |

The UI now shows both the date context and baseline in one line, separated by `·` (e.g., `Measured 29 Mar · Baseline: 117 cm`).

### Files Modified
| File | Change |
|------|--------|
| `src/app/api/health-fitness/okr/route.ts` | Added `fmtDate()` helper, populated `context` string for all metric types based on source table and averaging logic |
| `src/components/health/OkrCard.tsx` | Updated Row 3 to show context + baseline combined with `·` separator |
| `.claude/launch.json` | Fixed dev server PATH for homebrew node |
| `package.json` | Version bump 2.4.13 → 2.4.14 |

### No New Endpoints, Migrations, or Env Vars

---

## Ship: v2.4.15 — HRV Decline Fix + Health Insights Rewrite (2026-04-06)

**Commit:** `e6e793c` on `claude/youthful-bardeen`, merged to `main`

### What Changed

**Bug Fix: HRV Decline showing "No data" despite data existing**

Root cause: Supabase returns `numeric` columns as strings in JSON responses. Code did `r.hrv_7d_avg as number` which is still a string — `reduce((a, b) => a + b, 0)` then concatenated strings (`"047" + "46"` = `"04746"`) instead of adding numbers, producing NaN.

Secondary issue: On Sundays (or when WIB offset shifts date to next day), the "current week" had 0 completed days. Added fallback that shifts comparison back one week when current week is empty.

Fix applied to 3 locations:
1. 7-day Garmin averages (resting HR, steps, sleep, stress, body battery, HRV)
2. Earliest Garmin baseline computation
3. HRV week-over-week decline values

**Health Insights Rewrite**

Old prompt produced generic 20-word bullets that were misleading (e.g., "weight loss accelerating" when weight was actually going UP). Rewrote with:
- 3-section format: What's Working / Needs Attention / Focus This Week
- 30-day weight window (was 7 days) with pre-computed trend direction
- Explicit instruction to use recent trend, not just baseline comparison
- Measurement dates included for staleness detection
- Max tokens increased from 400 to 600

HealthInsights component updated to parse sections with colored headers (green/yellow/blue).

### Files Modified
| File | Change |
|------|--------|
| `src/app/api/health-fitness/okr/route.ts` | `Number()` conversion for all Supabase numeric values, HRV empty-week fallback |
| `src/app/api/health-fitness/insights/route.ts` | Rewritten prompt, 30-day weight window, trend pre-computation, `fmtDate()` helper |
| `src/components/health/HealthInsights.tsx` | Section parser with colored headers, fallback flat rendering |
| `package.json` | Version bump 2.4.14 → 2.4.15 |

### Gotchas for Next Session
1. **Supabase numeric columns are strings** — Always use `Number()` when doing arithmetic on Supabase query results. This has now been fixed in the OKR route but may exist in other routes.
2. **WIB double-offset on local dev** — The dev machine is in WIB timezone, so `Date.now() + wibOffset` double-shifts. The HRV fallback handles this, but other date-sensitive code may have similar issues.
3. **Health insights cache** — Insights are cached once per day in `briefing_cache.baseline_snapshot.health_insights`. Clear with: `UPDATE briefing_cache SET baseline_snapshot = baseline_snapshot - 'health_insights' WHERE date = 'YYYY-MM-DD'`

### No New Endpoints, Migrations, or Env Vars

---

## Ship: v2.4.16 — OKR Trend Arrows + Font/Color Fixes + Narrative Insights (2026-04-06)

**Commit:** `50ecd58` on `claude/youthful-bardeen`, merged to `main`

### What Changed

**OKR Trend Arrows**

Each metric now shows a colored trend arrow comparing current vs previous value:
- `↑ +1 kg` (red for lower_is_better going up)
- `↓ -0.7%` (green for lower_is_better going down)
- `→ stable` (when delta below threshold)

Previous value sources: weight (2nd weigh-in), measurements/blood work (2nd entry per type), Garmin averages (oldest day in window), stable Garmin (2nd non-null row). HRV decline/training have no trend (already comparative). Per-metric thresholds prevent noise.

**Font Size + Color Legibility**

- Subtext: `text-[10px]`→`text-xs`, labels/values: `text-sm`→`text-base`, headers: `text-base`→`text-lg`
- All `text-jarvis-text-dim` (#475569) → `text-jarvis-text-muted` (#64748b) for readability

**Health Insights — Narrative Style**

Prompt rewritten: leads with "so what" interpretation backed by data, includes BIA scale context (not DEXA), 30-day weight window, flags stale measurements. Max tokens 700.

### Files Modified
| File | Change |
|------|--------|
| `src/app/api/health-fitness/okr/route.ts` | `previous_value`, `resolvePreviousValue()`, weight limit(2), previous maps |
| `src/components/health/OkrCard.tsx` | Font bumps, dim→muted, `computeTrend()`, trend arrows |
| `src/app/api/health-fitness/insights/route.ts` | Narrative prompt, BIA context |
| `src/app/health/page.tsx` | Added `previous_value` to KrProgress |
| `package.json` | Version bump 2.4.15 → 2.4.16 |

### No New Endpoints, Migrations, or Env Vars

---

## Ship: v2.4.17 — Auto-sync Stale Fitness Cache + Steps Target Fix (2026-04-06)

**Commit:** `19558c5` on `claude/interesting-noyce`, merged to `main`

### What Changed

**Bug Fix: Fitness card showing wrong week number**

Dashboard showed "Week 10" when it should have been "Week 11" (April 6). Root cause: GET /api/fitness reads the fitness_context cache table directly without checking staleness. If the daily cron hasn't fired yet, yesterday's cached week number is returned.

Fix: The GET endpoint now compares the cached synced_at date (in WIB) against today. If stale, it calls syncFitness(true) inline before returning data. First request of the day may be slower but guarantees correct data.

**Steps Target Update (Supabase direct)**

Updated program_schedule.steps_target from 9,000 to 10,000 for all weeks >= 3. Weeks 1-2 remain at 9,000. Applied via direct SQL UPDATE, not migration.

### Files Modified
| File | Change |
|------|--------|
| `src/app/api/fitness/route.ts` | Added syncFitness import, staleness detection + auto-sync before returning cached data |
| `package.json` | Version bump 2.4.16 → 2.4.17 |

### Data Changes (Supabase, not via migration)
- program_schedule: steps_target = 10000 WHERE week >= 3

### No New Endpoints, Migrations, or Env Vars

---

### Dashboard UX Fixes (v2.4.21, 2026-04-09)

Three interconnected fixes to dashboard quality.

**1. Context-aware KPI topcard coloring**

The KPI row treated all trend arrows as green=up, red=down regardless of metric semantics. Training Readiness "LOW" qualifier showed green (was in the "good" list because LOW stress is good). Weight progress showed 100% "On track" even when above target.

Fix: Added `lowerIsBetter` flag from API, threaded through all color logic.

- Qualifier colors are now context-dependent: "LOW" → red for Training Readiness, green for stress-type metrics
- Trend arrows: Weight-down = green, Steps-up = green, RHR-down = green
- Weight progress formula inverted: at 90kg with target 87kg → 97% (was 100%)
- Progress bar colors aligned with text meaning thresholds
- All hardcoded `text-emerald-400` replaced with `text-jarvis-success` theme tokens

**2. Health insights timezone bug**

`/api/health-fitness/insights` calculated `sevenDaysAgo` and `thirtyDaysAgo` in UTC, but weight entries are stored with WIB dates. Applied same WIB offset pattern used by `getWibToday()` in the same file.

**3. Mobile UI — utilities page**

Cost summary grid forced 2 columns on mobile with no responsive breakpoint. Fixed: `grid-cols-1 md:grid-cols-2`, tighter sub-grid gaps, border switches from left to top on mobile. Also reduced AppShell mobile padding from `p-5` to `p-3 sm:p-5`.

### Files Modified
| File | Change |
|------|--------|
| `src/app/api/kpis/route.ts` | Added `LOWER_IS_BETTER` set, inverted progress formula for weight/RHR, added `lowerIsBetter` to response |
| `src/components/KpiRow.tsx` | Replaced static `TREND_ICONS` with `getTrendDisplay()`, context-aware `qualifierColor()`, aligned progress bar colors |
| `src/components/HealthCard.tsx` | Fixed duplicate `qualifierColor` — LOW→red, HIGH→green, theme tokens |
| `src/app/api/health-fitness/insights/route.ts` | Applied WIB offset to date range calculations |
| `src/app/utilities/page.tsx` | Responsive cost summary grid, mobile-friendly borders/gaps |
| `src/components/AppShell.tsx` | Reduced mobile padding: `p-3 sm:p-5 md:p-6` |
| `package.json` | Version bump → 2.4.21 |

### Key Gotchas
1. **`LOWER_IS_BETTER` is a code-level set, not DB** — Currently `['Resting Heart Rate', 'Weight']`. If user switches to a bulk/gaining phase, Weight would need to be removed. Future enhancement: read from `fitness_context.current_phase`.
2. **AppShell padding change is global** — The `p-3` mobile padding affects ALL pages, not just utilities. Monitor for any page looking too tight.
3. **HealthCard has its own `qualifierColor` copy** — Not shared with KpiRow. HealthCard metrics (sleep, body battery, training readiness) are all higher-is-better, so LOW is always red there.

### No New Endpoints, Migrations, or Env Vars for v2.4.21

---

### KPI Topcard Data Improvements (v2.4.22, 2026-04-09)

Follow-up to v2.4.21 coloring fixes — adds missing qualifiers and refines weight progress logic.

**1. HRV 7d Average qualifier**

Garmin provides `hrv_status` (e.g., "BALANCED", "UNBALANCED") in garmin_daily but it was never passed to the KPI. Now included as qualifier, shown on the topcard with context-aware coloring.

**2. Daily Steps target + qualifier**

Steps KPI now has target of 10,000 and computed qualifier:
- >= 10,000 → "Good" (green)
- >= 8,000 → "Fair" (orange)
- < 8,000 → "Poor" (red)

Progress bar now shows for steps (e.g., 8,500 avg → 85%).

**3. Weight progress: kg-gap-based**

Replaced ratio-based weight progress with gap-to-target tiers:
- < 5kg from target → green (progress 80-100%)
- 5-10kg → orange (progress 50-80%)
- 10-20kg → red (progress 20-50%)
- > 20kg → deep red (progress < 20%)

Target remains 87kg (hardcoded in weight POST route).

### Files Modified
| File | Change |
|------|--------|
| `src/lib/sync/garmin.ts` | Pass hrv_status as HRV qualifier, add steps target/qualifier, write kpi_target on upsert |
| `src/app/api/kpis/route.ts` | Weight-specific gap-based progress calculation |
| `package.json` | Version bump → 2.4.22 |

### Key Gotchas
1. **Steps qualifier is computed, not from Garmin** — Uses thresholds (10k good, 8k fair, below poor). Garmin doesn't provide a step quality qualifier.
2. **HRV/Steps changes require Garmin sync to take effect** — Existing KPI rows won't have the new qualifier/target until the next cron run (3x daily: 7am, 1pm, 7pm WIB).
3. **Weight gap formula is continuous** — Bar width smoothly decreases as gap increases, but color band boundaries align exactly with the kg tiers.

### No New Endpoints, Migrations, or Env Vars for v2.4.22

---

### Cardio Analysis Pipeline Fixes + Cadence Display (v2.4.23 – v2.4.32, 2026-04-11 to 2026-04-16)

A series of linked fixes to make the Cardio Analysis pipeline pick up new runs reliably, backfill historical data, and correct the cadence metric to match the Garmin Connect app.

**1. Morning-run visibility (v2.4.23)**

The pipeline only read `garmin_activities` from Supabase. The Garmin cron runs at 07:00 WIB, so runs done later in the morning were invisible to manual analysis triggers.

Fix: Added Step 0 to the pipeline that calls a new lightweight `syncRecentActivities()` before querying. Safe to call (no daily-metric fetches, no pruning), uses ~1 API call, graceful fallback if blocked.

**2. Historical backfill support (v2.4.24 – v2.4.27)**

- `backfillDateRange` now paginates through `getActivities()` in batches of 100 until it reaches the target start date (up to 500 activities deep). The old single-page fetch could only reach ~2 months back.
- Garmin backfill endpoint now accepts `x-cron-secret` in addition to browser auth (allows CLI-triggered backfills).
- `pruneOldRecords()` exempts running activities from the 56-day retention cutoff. Running data is kept indefinitely for long-term analysis; walks/strength sessions still prune after 56 days.

**3. Cadence metric fix (v2.4.31)**

Problem: Cardio Analysis showed Apr 14 cadence as 157 spm; Garmin Connect app showed 160+. Root cause: pipeline used `averageRunningCadenceInStepsPerMinute` which averages over total elapsed time (including auto-pauses). Garmin Connect displays moving cadence: `steps / movingDuration`.

Fix: `extractRunActivity` now prefers `steps / movingDuration` when both fields are present, falls back to the overall average otherwise.

**4. Cadence in UI (v2.4.32)**

- New "Cadence" column in the All Runs table on the Cardio Analysis page.
- Weekly Insights sub-header now shows distance-weighted average cadence (via new `weightedAvgCadence()` helper).
- New `Avg Cadence (spm)` number property on the Weekly Insights Notion DB.
- `ensureDbSchema()` auto-adds missing properties on existing DBs so future schema additions don't require manual migration.

### Files Modified
| File | Change |
|------|--------|
| `src/lib/running-analysis/index.ts` | Step 0 `syncRecentActivities()` call, moving cadence formula in extractRunActivity |
| `src/lib/running-analysis/analysis-engine.ts` | `weightedAvgCadence()`, `avgCadenceSpm` in WeeklyAnalysis, wired through empty-week and final return |
| `src/lib/running-analysis/weekly-insights-db.ts` | `avgCadenceSpm` in WeeklyInsightEntry, DB schema property, `ensureDbSchema()` migration helper, upsert + parse wired |
| `src/lib/sync/garmin.ts` | `syncRecentActivities()` export, paginated backfill in `backfillDateRange`, running-activity exemption in `pruneOldRecords()` |
| `src/app/api/sync/garmin/backfill/route.ts` | `withEitherAuth` — cookie OR cron secret |
| `src/app/cardio-analysis/page.tsx` | Cadence column in runs table, avg cadence in week sub-header |
| `package.json` | Version bumps 2.4.22 → 2.4.32 |

### Data Changes (production, not via migration)
- Backfilled `garmin_activities` with runs from Sep 2025 – Mar 2026 (~200 rows)
- Updated `Cadence (spm)` on 13 Notion Run pages with corrected moving-cadence values
- Added `Avg Cadence (spm)` column to Weekly Insights Notion DB
- Backfilled `Avg Cadence (spm)` on 9 Weekly Insights pages (Jan 26 – Apr 16)

### Key Gotchas
1. **Cadence corrections only apply going forward in the UI** — Existing Weekly Insights commentary (`How Was This Week`, etc.) still references old cadence numbers in text. Re-run a week's analysis if updated commentary is needed.
2. **The weighted cadence is distance-weighted** — Longer runs have more influence than short ones. Shorter/interrupted runs (e.g., Jan 31 0.95km run at 170 spm) can have extreme values that barely affect the week total.
3. **Running-activity exemption is a string match** — `pruneOldRecords` uses `activity_type NOT ILIKE '%run%'`, which catches `running`, `track_running`, `trail_running`, `treadmill_running`, etc. Treadmill runs are therefore also kept indefinitely even though they are excluded from outdoor analysis.
4. **Garmin daily budget can block the backfill** — The paginated backfill consumes ~1 call per 100 activities fetched. Long backfills (back to 2025) use ~3-5 calls total, but combined with the regular cron's 11 calls it's possible to hit the 50/day budget. Reset via `UPDATE api_usage_v2 SET call_count = 0 WHERE date = ... AND service = 'garmin'` in Supabase SQL Editor.

### Security Hardening (v2.4.33, 2026-04-16)

Routine security review conducted in-session; 19 findings filed into the plan at `~/.claude/plans/linked-painting-manatee.md` and fully implemented before ship.

**Critical (prompt injection + XSS)**
- C1 — Voice intent transcript now sanitized (`sanitizeMultiline`) and wrapped in `<untrusted_user_transcript>` delimiters with a `UNTRUSTED_PREAMBLE` instructing Claude to treat wrapped content as data, not instructions.
- C2 — Same treatment applied to every Claude pipeline that embeds external text: email triage (classification + draft replies), email synthesis, morning briefing (calendar titles + task names), news synthesis (newsletter bodies).
- C3 — `renderMarkdown` now HTML-escapes its input before any regex substitution. Any `<script>` / `<img onerror=...>` emitted by Claude (or echoed from upstream email content) is rendered as inert text rather than executed.

**High (OAuth + data at rest)**
- H1 — Google + Microsoft OAuth routes generate a signed state token stored in an httpOnly cookie (`src/lib/oauthState.ts`, HMAC-SHA256, 10-minute TTL). Callbacks reject mismatches.
- H2 — Google + Microsoft OAuth access/refresh tokens encrypted at rest via AES-256-GCM (`src/lib/crypto.ts`). Legacy plaintext rows pass through decrypt() so migration is transparent; the next refresh re-encrypts.
- H3 — Garmin OAuth tokens moved out of `sync_status.last_error` into a dedicated `garmin_tokens` table (migration-020), encrypted. Legacy location read as fallback during migration window, then cleared.
- H4 — Swept 21 API routes: no more `String(err)` / `err.message` / Supabase `error.message` leaked to clients. All routed through `safeError()` or replaced with generic responses.
- H5 — `garmin_daily.raw_json` and `garmin_activities.raw_json` wrapped as `{ enc: "enc:v1:..." }` on write. `unwrapJsonb()` transparently decrypts on read (running-analysis, health-fitness route, backfill paths).

**Medium**
- M1 — Session cookie `maxAge`: 30 days → 7 days.
- M2 — Deleted localStorage-backed Bearer token on the dashboard (`src/app/page.tsx`). httpOnly cookie is sent automatically on same-origin fetch.
- M3 — CSP moved from `next.config.ts` to `src/middleware.ts` with a per-request nonce and `strict-dynamic`. Dropped `'unsafe-inline'` for `script-src`.
- M4 — `src/lib/supabase.ts` throws if imported from a client component (`typeof window !== 'undefined'` guard), preventing accidental service-role key bundling.
- M5 — Hardcoded work-email constants replaced with `WORK_GMAIL_ADDRESS` / `WORK_OUTLOOK_ADDRESS` env vars.
- M6 — CLAUDE.md documents Garmin password limitation, `CRYPTO_KEY` requirement, and a new Security Posture section.
- M7 — `/api/contacts/scan` now validates body with `ContactsScanSchema` (Zod).

**Low**
- L1 — `assertServerEnv()` blocks `JARVIS_AUTH_TOKEN` / `CRON_SECRET` shorter than 32 chars (rotated `JARVIS_AUTH_TOKEN` from 20 → 48 chars during ship).
- L2 — `Cache-Control: no-store, no-cache, must-revalidate, private` on all `/api/cron/*` responses (middleware).
- L4 — `npm run audit:security` script added.

**New modules**
| File | Purpose |
|------|---------|
| `src/lib/crypto.ts` | AES-256-GCM `encrypt` / `decrypt` + `wrapJsonb` / `unwrapJsonb` for JSONB columns |
| `src/lib/promptEscape.ts` | `sanitizeInline`, `sanitizeMultiline`, `wrapUntrusted`, `UNTRUSTED_PREAMBLE` |
| `src/lib/env.ts` | `assertServerEnv()` runtime validation |
| `src/lib/oauthState.ts` | Signed OAuth state cookie helpers |
| `supabase/migration-020-garmin-tokens.sql` | `garmin_tokens` table (encrypted token blob) |

### New Env Vars
| Var | Required | Notes |
|-----|----------|-------|
| `CRYPTO_KEY` | ✅ Yes | 32-byte base64. Encrypts OAuth tokens and `raw_json`. Rotating invalidates all encrypted columns. |
| `WORK_GMAIL_ADDRESS` | No (defaults to `filman@group.infinid.id`) | |
| `WORK_OUTLOOK_ADDRESS` | No (defaults to `filman@infinid.id`) | |

### New Migration
- `migration-020-garmin-tokens.sql` — applied to production Supabase during ship. Creates `public.garmin_tokens` with RLS enabled.

### Token rotation during ship
`JARVIS_AUTH_TOKEN` was 20 chars, below the new ≥32 threshold. Rotated to a new 48-char value in both `.env.local` files and Railway. Existing browser session cookies (signed with the old token) are invalidated — log out + log in to refresh.

### Security Gotchas
1. **`CRYPTO_KEY` is break-glass** — rotating it invalidates every stored OAuth token (Google + Microsoft + Garmin) and every `raw_json` column. Only rotate if the key is believed compromised, and plan for re-auth across all integrations.
2. **`decrypt()` is passthrough-safe** — any value that doesn't start with `enc:v1:` is returned as-is. This is intentional for transparent migration but means a bad value stored later won't be "protected" by the ciphertext prefix check. Always use `encrypt()` for new writes.
3. **CSP nonce requires Node crypto** — `crypto.randomUUID()` in middleware runs on the Edge runtime; both Node and Edge runtimes expose it.
4. **OAuth state cookie uses `sameSite: 'lax'`** — `'strict'` would be dropped on cross-site OAuth return redirects from Google/Microsoft. Signed HMAC + 10min TTL mitigates the reduced sameSite scope.
5. **`unsafe-inline` retained for `style-src`** — Tailwind v4 and Next.js inline critical CSS. Switching to nonce-based styles would require a broader styling-pipeline change.

---

## v2.4.38 — Apple Health Sync Fix (2026-04-18)

**Commit:** `ed94af0` — fix: exempt /api/health/* from Content-Type enforcement

The v2.4.33 security hardening added Content-Type: application/json enforcement on all API POST/PUT/PATCH requests. This inadvertently blocked iOS Shortcuts from pushing Apple Health data (weight, body measurements) to /api/health/weight and /api/health/measurements, since Shortcuts may not include that header.

**Fix:** Whitelisted /api/health/* from Content-Type enforcement in middleware, alongside the existing /api/auth/google and /api/auth/microsoft exemptions. These endpoints already require Bearer token auth, which inherently prevents CSRF (browsers cannot add custom Authorization headers in cross-origin requests), so the Content-Type check was redundant.

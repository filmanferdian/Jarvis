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

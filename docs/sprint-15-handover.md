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

### Key Gotchas
1. **Prodia lab names ≠ English marker names** — The `bloodWorkNameMap` in the OKR route must be updated if new markers are added with different naming conventions.
2. **Baselines set via direct SQL, not migration** — The 4 baseline values were UPDATEd directly in Supabase. Future blood draws will show progress against these Apr 1 baselines.
3. **BloodWorkPanel categories are hardcoded** — The 7 category groups in `BloodWorkPanel.tsx` match the Prodia HL II panel. Markers not in any category fall into "Other".
4. **Testosterone and BP have no data yet** — These show as "No data" in the O4 card. Testosterone baseline will be set when first test result is available.

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

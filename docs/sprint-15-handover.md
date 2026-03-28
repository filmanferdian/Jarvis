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

## Sprint 15 Candidates

### P0 — Carry-Forward
1. **Verify current events synthesis quality** — check newsletter distillation over real data
2. **OKR baselines remaining** — 6 KRs still missing baselines (blood work / manual metrics scheduled for Apr 1)

### P1 — Running Analysis Enhancements
3. **Running Analysis results view** — Show Weekly Insights history in the UI (table or cards of past weeks), not just trigger controls
4. **Trend sparklines for running** — 7-day pace, HR, distance charts on the Running Analysis page
5. **Backfill missing Garmin enrichment** — Feb 4 – Mar 22 runs in Notion have no weather/splits/decoupling (only added manually). Could fetch retroactively if Garmin still has the data.
6. **force_resync update vs create** — Currently creates a new Notion page even if one exists. Should PATCH the existing page properties instead to avoid needing manual archive cleanup.

### P1 — Health & Fitness
7. **Trend sparkline charts** — 7-day mini charts for each OKR metric on `/health` page (deferred from Sprint 13)
8. **Garmin sync health visibility** — surface circuit breaker state, last sync time, API budget remaining

### P2 — Polish
9. **Security monitoring dashboard** — show rate limit hits, auth failures in `/utilities`
10. **Mobile dashboard layout** — optimize card grid for small screens

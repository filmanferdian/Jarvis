# Sprint 14 Retrospective

**Version:** v2.3.1 → v2.4.1
**Date:** 2026-03-28
**Theme:** Running Analysis Automation

## Delivery Summary

- **Running Analysis page** — New sidebar nav item at Health & Fitness level (`/running-analysis`). Control panel UI with manual trigger, date override, analysis_only + force_resync flags, live result display, pipeline explainer.
- **Full data ingestion pipeline** — Supabase garmin_activities → Garmin API (splits/weather/perf condition/decoupling) → Notion Runs DB. Redundancy check by Garmin ID skips already-ingested activities. Outdoor-only filter (excludes treadmill, indoor, walking).
- **Weekly analysis engine** — Claude Sonnet generates 4-section analysis per week: how was this week, what's good, what needs work, focus next week. JSON-structured output, Jakarta heat/humidity context included in prompt.
- **Weekly Insights Notion DB** — Auto-created under Running Log page on first run. Cached DB ID in sync_status to avoid recreating. Upserts by week start date (idempotent).
- **Running Log dashboard update** — Updates subtitle (run count + date) and analysis section blocks via Notion REST API block patching.
- **Cron endpoint** — `GET /api/cron/running-analysis` (Saturday 12pm WIB = 05:00 UTC). Analyzes Mon–today of current week.
- **Manual trigger endpoint** — `POST /api/running-analysis` with optional `date`, `analysis_only`, `force_resync` params.
- **Historical backfill** — 5 Weekly Insights entries created covering Feb 4, Feb 10, Feb 18, Mar 22, Mar 23–28 weeks.
- **`createGarminClient` export** — Extracted from private scope in garmin.ts for reuse in the enrichment module.

## Key Decisions

1. **Garmin enrichment uses parallel Promise.allSettled** — Splits, weather, and details fetched concurrently with staggered delays (1.5s apart) to avoid rate limiting while keeping total time under 5s per activity.
2. **Decoupling calculated from HR/pace ratio drift** — First 50% vs second 50% of first 80% of run. Matches Garmin's methodology without needing the activityDecoupling metric directly.
3. **Weekly Insights DB auto-created on first run** — No manual Notion setup required. DB ID cached in sync_status table to survive deploys without re-creating.
4. **Current week range (Mon–today) instead of previous week** — Triggered on Saturday, the pipeline covers the week in progress. `date` override allows re-running any historical week.
5. **analysis_only flag for historical backfill** — Weeks before Garmin sync started (pre-Mar 16) have no Supabase data, but the Notion Runs DB has entries. analysis_only skips ingestion and reads directly from Notion for analysis.
6. **Notion DB ID is not the MCP data_source_id** — The MCP tool uses an internal `collection://` UUID that differs from the Notion REST API page ID. Fixed by using the search API to find the real ID (`061105bb...`).
7. **Cadence stored as half-steps in Garmin raw_json** — `averageRunningCadenceInStepsPerMinute` is per-foot (half cadence). Doubled when writing to Notion to get total steps/min.

## What Went Well

1. **Pipeline architecture is clean** — Each module (garmin-enrich, notion-runs-db, analysis-engine, weekly-insights-db, dashboard-update) has a single responsibility. Easy to test individually.
2. **Redundancy check worked as designed** — On re-run, existing Garmin IDs were detected and skipped without any manual intervention.
3. **Claude analysis prompt produced structured JSON reliably** — The JSON extraction regex handles surrounding text gracefully, making the response parsing robust.
4. **Historical backfill was one command per week** — The analysis_only flag made it trivial to generate Weekly Insights for all historical runs already in Notion.

## What Could Improve

1. **Worktree file placement confusion** — Created new files in main repo instead of worktree, requiring a copy step. Need to be more careful about which path is being edited.
2. **force_resync created duplicates** — The redundancy check was bypassed before the DB ID was fixed, creating 2 duplicate Notion pages that had to be archived manually. Should not bypass redundancy check even with force_resync; instead update existing entries.
3. **MCP data_source_id vs Notion REST ID** — Took 2 failed runs to identify. Should document this distinction for any future Notion DB references.
4. **Dashboard update is best-effort** — Relies on finding specific text patterns in Notion blocks. If the Running Log page structure changes, the update silently fails. Acceptable trade-off vs full page replace.

## Metrics

- **Versions deployed:** 2 (v2.4.0 feature, v2.4.1 polish + schedule fix)
- **New files:** 9 (6 lib modules + 2 API routes + 1 page)
- **Files modified:** 3 (Sidebar.tsx, garmin.ts, package.json)
- **Lines added:** ~2,050
- **Weekly Insights entries created:** 5 (backfill) + 1 (current week)
- **Runs in Notion Runs DB:** 8 (all properly de-duplicated)

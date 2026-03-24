# Sprint 12 Retrospective (partial)

**Version:** v2.2.8
**Date:** 2026-03-22
**Theme:** v2.2 Polishing — Incremental bug fixes and data reliability

## Delivery Summary

- **KPI cards curated:** 6 cards in fixed display order (Training Readiness, Sleep Score, RHR, HRV, Steps, Weight). Removed Stress Level, VO2 Max, Endurance Score.
- **Steps changed to 7-day average** excluding current day (was yesterday's single value)
- **Fitness Program database:** Replaced AI extraction with structured Notion database (365 days). Deterministic day-by-day schedule, deload every 4 weeks.
- **Deload fix:** Every 4th week (4, 8, 12, ..., 52), not just phase boundaries
- **Email synthesis:** 2-period visibility (current + previous pull), time_slot support to prevent overwriting
- **News synthesis:** Already had time_slot support, verified working
- **Tasks card:** 3-day visibility (today/tomorrow/day after) instead of full week
- **Dashboard cleanup:** Removed redundant HealthCard from main dashboard
- **OKR fixes:** Measurement type mapping, number formatting, baselines, waist baseline
- **Fitness API:** Fixed double timezone offset in day-of-week calculation
- **Eating window:** Hardcoded 12:00-20:00 default, removed Ramadan detection
- **Bullet point gaps:** Fixed in briefing and synthesis rendering

## Key Decisions

- **Notion database over AI extraction** — Claude AI interpreted free-form Notion content every sync, causing recurring bugs (Ramadan eating window, wrong day mapping). Structured database eliminates the interpretation layer entirely.
- **Fixed KPI display order** — Hardcoded in frontend component rather than DB ordering. Simpler, no migration needed, user controls what appears.
- **7-day step average** — More meaningful than a single day's count which can swing wildly.
- **3-day task visibility** — Full week was too long; 3 days keeps focus on immediate priorities.

## What Went Well

- Incremental polishing approach worked well — user gives one task at a time, we fix and verify before moving on
- Notion database for fitness is a significant reliability improvement
- Removing HealthCard reduces visual clutter without losing information (KPI cards cover it)

## What Could Improve

- Email synthesis time_slot migration was deployed mid-day, so morning/afternoon data for Mar 22 was lost to the old overwrite pattern
- Sprint 12 is spread across multiple sessions — context handoff between sessions needs improvement
- Deload schedule was wrong (only phase boundaries) and took user feedback to correct

## OKR Page Redesign

- **Layout reorder:** Health Insights moved below O4 (BloodWorkPanel) — previously appeared between OKR cards and O4, breaking the logical flow
- **OkrCard redesign:** Each key result row now shows:
  - Status badge (On track / Behind / Off track / No data)
  - Current / Target values with consistent formatting and units (e.g., `9,500 / 9,000 steps`)
  - Thicker progress bar with status-colored fill
  - Baseline annotation below bar (`Baseline: 115.3 kg`)
  - Progress percentage (`42% of goal`)
- **Consistent value formatting:** Shared `formatMetricValue()` applied to baseline, current, and target — no more mismatched formats (e.g., `9,500` vs `9000`)
- **Dynamic baseline computation:** API computes baselines from earliest 7 days of Garmin data and weight_log for metrics with NULL `baseline_value`. DB values always take priority over computed ones.

## Metrics

- Version: 2.2.1 → 2.2.8 (7 patch deployments)
- Notion database rows created: 363 (of 364 target)
- KPI cards: 9 → 6 (removed 3 redundant)
- Dashboard cards: removed 1 (HealthCard)

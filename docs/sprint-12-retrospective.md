# Sprint 12 Retrospective

**Version:** v2.2.1 → v2.2.10
**Date:** 2026-03-22 to 2026-03-24
**Theme:** v2.2 Polishing — Incremental bug fixes, data reliability, OKR page redesign

## Delivery Summary

### Dashboard & Data Fixes (v2.2.1–v2.2.8)
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

### Contact Scanner (v2.2.9)
- Scans Google Calendar + Outlook for external attendees
- Filters internal domains, matches against 233 Notion Contacts, updates "Last contact" date
- New `/contacts` page with triage table, batch sync to Notion
- New migration: `migration-016-scanned-contacts.sql`

### OKR Page Redesign (v2.2.10)
- **Layout reorder:** Health Insights moved below O4 (BloodWorkPanel)
- **OkrCard redesign:** Status badges, current/target with units, baseline annotations, progress percentage
- **Consistent value formatting:** Shared `formatMetricValue()` — body fat 1 decimal, HR/stress integers, sleep always 1 decimal, steps comma-separated for both current and target
- **Dynamic baseline computation:** API computes baselines from earliest 7 days of Garmin data for NULL `baseline_value`. DB values always take priority.
- **Garmin date range backfill:** New `backfillDateRange()` function bypasses 56-day retention limit. Used to fetch Jan 19-25, 2026 data for program-start baselines.
- **Baselines populated:** All Garmin metrics baselined from Jan 19-25 averages. Manual entries: lean mass 75.3 kg, waist 117 cm, dead hang 17s, training 100%, OHS 2, fitness age 37, steps 9,022.
- **Steps progress fix:** Changed from `higher_is_better` to `range` direction. Current >= target_min = 100% (was showing red when exceeding target).
- **HRV decline redesigned:** Now computes week-over-week decline (Mon-Sun avg vs previous Mon-Sun avg) instead of raw HRV value. Shows context: "Prev week: 46 ms → This week: 50 ms".
- **Body Battery removed from O5:** Unreliable as OKR metric (changes hourly, only synced 3x/day). O5 now has 3 KRs: Sleep, HRV Decline, Stress.
- **Notion OKR page updated:** Removed Body Battery KR, updated HRV description to week-over-week comparison.
- **VO2 Max / Fitness Age fix:** Stable metrics now scan backwards through recent rows to find first non-null value, instead of always reading today's (potentially incomplete) row.
- **Progress calc fix:** `lower_is_better` metrics where baseline is already below target (e.g., stress 37 vs target 40) now correctly show 100% instead of red. Same for `higher_is_better` when current exceeds target.

## Key Decisions

- **Notion database over AI extraction** — Structured database eliminates interpretation bugs (Ramadan, wrong day mapping).
- **Fixed KPI display order** — Hardcoded in frontend, simpler than DB ordering.
- **7-day step average** — More meaningful than single day's count.
- **3-day task visibility** — Full week was too long; 3 days keeps focus.
- **Week-over-week HRV** — More actionable than long-term baseline comparison. Decline >15% in a single week signals overtraining or poor recovery.
- **Body Battery removed** — Too volatile for OKR tracking. Still visible in KPI cards on dashboard.
- **Garmin baselines from Jan 19-25** — 7 days prior to earliest Garmin data in DB. Program started Oct 2025 but Garmin sync only added in Sprint 7.

## What Went Well

- Incremental polishing approach — user gives one task at a time, fix and verify
- Notion database for fitness is a significant reliability improvement
- OKR page redesign addressed multiple UX issues in one session
- Garmin date range backfill enabled proper baseline computation without schema changes

## What Could Improve

- Email synthesis time_slot migration deployed mid-day, lost morning/afternoon data for Mar 22
- Sprint 12 spread across multiple sessions — context handoff between sessions needs improvement
- Deload schedule was wrong (only phase boundaries) and took user feedback to correct
- HRV decline was displaying raw milliseconds as percentages — caught late, should have been caught during Sprint 7 OKR setup

## Metrics

- Version: 2.2.1 → 2.2.10 (10 deployments)
- Notion database rows created: 363 (of 364 target)
- KPI cards: 9 → 6 (removed 3 redundant)
- Dashboard cards: removed 1 (HealthCard)
- OKR baselines populated: 17 of 23 KRs (remaining 6 are blood work / manual measurements)
- O5 KRs: 4 → 3 (removed Body Battery)
- New page: `/contacts` — calendar invite contact scanner
- New cron: `/api/cron/contact-scan` — weekly contact scanning
- External contacts scanned: 14 from 209 calendar events (4-week backfill)

# Sprint 12 Retrospective

**Version:** v2.2.8 → v2.2.13+
**Date:** 2026-03-22 to 2026-03-24
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
- **Cron error visibility:** Added `logCronRun` to email synthesis cron for persistent error history
- **Investigation:** Email missing slots on Mar 24 caused by Anthropic credit exhaustion, not code bug (Mar 23 had all 3 slots working)
- **Email style analysis:** Scan sent emails from Outlook and Gmail, derive conversation style using Claude. UI trigger on utilities page.
- **Ghostwriting style guide:** Created Notion page under About Filman with full email style guide derived from 129 sent emails. Added as `ghostwriting` context page key, synced to all Jarvis Claude calls via `allPages()`. Condensed version added to CLAUDE.md.
- **Email triage + auto-draft:** Scan work inbox emails (filman@infinid.id Outlook, filman@group.infinid.id Gmail) during email synthesis cron. Claude classifies each email (need_response/informational/newsletter/notification/automated). For need_response emails, auto-generates draft replies using ghostwriting style and creates them in Outlook Drafts folder. Gmail drafts also supported after scope upgrade.
- **Email triage UI:** New `/emails` page with summary cards, expandable need-response rows showing original email + draft preview, collapsible other-emails section. Sidebar nav added.
- **Dashboard triage KPI card:** First card in KPI row showing triaged/total count (e.g. 3/31) with date and time slot label. Links to /emails page.
- **OAuth scope upgrades:** Microsoft Mail.ReadWrite (for draft creation), Google gmail.compose (for Gmail drafts). Both require re-authentication after deploy.

## Key Decisions

- **Notion database over AI extraction** — Claude AI interpreted free-form Notion content every sync, causing recurring bugs (Ramadan eating window, wrong day mapping). Structured database eliminates the interpretation layer entirely.
- **Fixed KPI display order** — Hardcoded in frontend component rather than DB ordering. Simpler, no migration needed, user controls what appears.
- **7-day step average** — More meaningful than a single day's count which can swing wildly.
- **3-day task visibility** — Full week was too long; 3 days keeps focus on immediate priorities.
- **Ghostwriting as separate context page** — Kept distinct from Communication style (which covers AI interaction preferences). Ghostwriting is specifically for email voice/tone replication.
- **Batch triage classification** — Single Claude call classifies all emails (not per-email), keeping costs low. Draft generation batches up to 3 emails per call.
- **Outlook createReply for threading** — Uses Graph API createReply + PATCH pattern to properly thread draft replies in Outlook conversations.

## What Went Well

- Incremental polishing approach worked well — user gives one task at a time, we fix and verify before moving on
- Notion database for fitness is a significant reliability improvement
- Removing HealthCard reduces visual clutter without losing information (KPI cards cover it)

## What Could Improve

- Email synthesis time_slot migration was deployed mid-day, so morning/afternoon data for Mar 22 was lost to the old overwrite pattern
- Sprint 12 is spread across multiple sessions — context handoff between sessions needs improvement
- Deload schedule was wrong (only phase boundaries) and took user feedback to correct

## What Could Also Improve

- Cron failures were invisible until cron_run_log was added — should add logging to all cron routes
- Anthropic credit monitoring should be proactive (alert before exhaustion)

## Metrics

- Version: 2.2.1 → 2.2.12 (20+ patch deployments across 3 days)
- Notion database rows created: 363 (of 364 target)
- KPI cards: 9 → 6 health + 1 email triage (removed 3 redundant, added 1 new)
- Dashboard cards: removed 1 (HealthCard)
- Cron routes with logging: email-synthesis, email-triage
- New pages: /emails (email triage), /contacts (contact scanner)
- New Notion context page: ghostwriting (style guide from 129 sent emails)
- New Supabase table: email_triage (migration-017)
- OAuth scopes added: Microsoft Mail.ReadWrite, Google gmail.compose
- Sent emails analyzed: 129 (style derivation)

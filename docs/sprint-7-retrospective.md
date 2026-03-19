# Sprint 7 Retrospective

**Version:** v1.7.0
**Date:** 2026-03-19
**Theme:** Health & Fitness OKR Dashboard + Operational Visibility

## Delivery Summary

- **Files changed:** 32
- **Lines added:** ~2,200
- **New tables:** 4 (health_measurements, blood_work, okr_targets, api_usage_v2)
- **New pages:** 2 (/health, /utilities)
- **New API routes:** 10
- **Migration:** migration-010-sprint7.sql

## What Was Built

### P0 — Foundation
- **Versioning system** — `1.7.0` format with prominent pill badge in TopBar
- **Live WIB clock** — date and time display, responsive (time-only on mobile)
- **Fitness extraction fix** — anchored to today's WIB date, prevents future week extraction
- **Fitness sync cron** — weekly trigger + 6-hour dashboard debounce
- **Garmin cron fix** — retry with exponential backoff + session caching in Supabase

### P1 — Health & Fitness OKR Dashboard
- `/health` page with 5 OKR cards (O1-O5), progress bars, blood work panel, manual entry form
- Apple Health webhook expansion (`POST /api/health/measurements`) for body fat, waist, BP, lean body mass
- Blood work API (`POST /api/health/blood-work`) for quarterly lab results
- OKR progress API computing % toward each target from Garmin, Apple Health, and blood work data
- Trends API for time-series chart data (56-day window)

### P1 — Utilities Page
- `/utilities` page with integration health dashboard (green/yellow/red per sync)
- Per-service API usage tracking (Claude tokens, ElevenLabs chars, OpenAI)
- Monthly cost estimation (variable + fixed costs)
- ElevenLabs quota bar with 30k char/month tracking

### P1 — Other
- ElevenLabs → OpenAI TTS auto-failover at 29k/30k chars
- 56-day data retention with pruning for Garmin, weight, health measurements
- Garmin backfill endpoint for initial 56-day historical data
- Delta briefing (mid-day change summary)

### P2 — Polish
- Sidebar navigation (Dashboard | Health & Fitness | Utilities)
- Alfred/British butler voiceover persona across all prompts
- Garmin session caching to avoid rate-limited logins

## What Went Well

1. **Scope was ambitious but coherent** — all three themes (health OKR, utilities, versioning) complement each other and make Jarvis feel like a real product
2. **Apple Health integration design** — using iOS Shortcuts as the bridge is pragmatic and requires no additional server infrastructure
3. **OKR-driven health tracking** — directly aligned with the Notion OKR framework, making the dashboard immediately useful
4. **Session caching** — identified and addressed the Garmin rate-limiting root cause that had been plaguing cron syncs

## What Could Be Better

1. **Garmin rate limiting** — Cloudflare banned Railway's IP after multiple login attempts during development. Session caching was implemented to fix this, but the backfill couldn't complete in this sprint. Need to retry when rate limit clears.
2. **No charts yet** — the `/health` page has progress bars but no sparkline trend charts. The API supports it (`GET /api/health-fitness/trends`) but the frontend component wasn't built.
3. **No AI insights section** — planned in the mockup but not implemented. The health page shows OKR progress but doesn't have Claude-generated insights yet.
4. **Testing on mobile** — couldn't verify mobile layout on the deployed site during this sprint.

## Carry-Forward to Sprint 8

1. **Garmin backfill** — retry `POST /api/sync/garmin/backfill` once rate limit clears
2. **Trend sparkline charts** — `TrendSparkline.tsx` component for health page
3. **AI-generated health insights** — Claude analyzes recent data and surfaces observations
4. **Health page improvements** — stale data warnings, quarterly lab reminders
5. **ElevenLabs voice tuning** — Morgan stability 0.75 (P2, not implemented)

## Key Decisions

- Used `sync_status.last_error` column to store Garmin session tokens (avoids adding a new table)
- OKR targets stored in database (`okr_targets` table) rather than hardcoded, allowing runtime updates
- Kept `/api/health/weight` endpoint separate from the new `/api/health/measurements` for backward compatibility with existing iOS Shortcuts
- Per-service API tracking uses a new `api_usage_v2` table alongside the existing `api_usage` table (no migration of existing data needed)

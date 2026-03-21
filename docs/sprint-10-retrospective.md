# Sprint 10 Retrospective

**Date:** 2026-03-21
**Theme:** Garmin API Rate Limiting Fix + Integration Health + OKR Data Wiring

## Delivery Summary

- **Files modified:** 9
- **New scripts:** 2 (`seed-garmin-tokens.mjs`, `backfill-recent.mjs`)
- **New tables/migrations:** 0
- **Root cause identified:** Cloudflare blocks Railway's datacenter IP at `sso.garmin.com` (login endpoint), not the data endpoints

## What Was Built

### P0 — Garmin API Circuit Breaker & Rate Limiting
- **Circuit breaker** stored in `sync_status` table — auto-blocks all Garmin API calls on 429/Cloudflare detection, auto-clears after cooldown
- **Exponential backoff** on repeated failures: 6h → 12h → 24h → 48h (capped), resets on success
- **Daily API call budget** of 50 calls tracked via `api_usage_v2`
- **Sequential API calls** with 1s gaps — replaced parallel bursts of 8-10 requests that triggered Cloudflare
- **429 error detection** — scans error messages for rate limit patterns, parses Retry-After headers
- **Reduced aggressiveness** — login retries 3→1, incremental backfill disabled (building data forward from Mar 16)
- **Graceful cron handling** — all route handlers return HTTP 200 + skip when blocked (prevents cron-job.org retry storms)

### P0 — Token Seeding from Residential IP
- **Root cause:** Railway's datacenter IP is banned at `sso.garmin.com`, not at data endpoints
- **Solution:** `scripts/seed-garmin-tokens.mjs` — login from user's residential IP, export OAuth1+OAuth2 tokens to Supabase
- OAuth1 tokens last ~1 year, OAuth2 auto-refreshes via `connectapi.garmin.com` (not SSO)
- Railway cron now uses cached tokens and never hits `sso.garmin.com`

### P1 — Activity Timezone Fix
- `startTimeGMT` from Garmin API lacks timezone suffix → parsed as local time → wrong dates
- Switched to `startTimeLocal` with `+07:00` WIB offset — activities now show correct dates

### P1 — Fitness Age Endpoint
- Added `/fitnessage-service/fitnessage/{date}` — dedicated endpoint that returns fitness age, components (BMI, RHR, vigorous days), and achievable target
- `garmin_daily.fitness_age` now populated on every cron run

### P1 — Integration Health Dashboard Fixes
- Added `markSynced()` to email-synthesis and morning-briefing cron routes (were missing)
- Filtered out internal sync types (`garmin-tokens`, `garmin-circuit-breaker`) from Integration Health cards
- Aligned `EXPECTED_INTERVALS` with actual cron-job.org schedule

### P1 — OKR Dashboard Data Wiring
- Daily Garmin metrics (steps, sleep, stress, HR, body battery, HRV) now show **7-day rolling average** instead of single latest value
- VO2 Max and Fitness Age show latest value (stable metrics)
- Today's incomplete data excluded from averages
- Set baselines for all Garmin-sourced OKR metrics

## What Went Well

1. **Research-driven approach** — investigating GitHub issues for garmin-connect and python-garminconnect revealed the exact failure patterns and block durations
2. **Token seeding** was the breakthrough — understanding that the block is IP-specific to `sso.garmin.com` login, not data endpoints, made the solution simple
3. **Circuit breaker prevents cascading failures** — the cron no longer makes things worse when blocked
4. **Backfill scripts** (`seed-garmin-tokens.mjs`, `backfill-recent.mjs`) are reusable for future recovery

## What Could Be Better

1. **Multiple deploys without version bump** — violated versioning discipline, need to batch changes better
2. **Budget of 50 calls/day is tight** — 3 cron runs × 11 calls = 33 calls, leaving only 17 for manual triggers. May need to increase
3. **No automated alerting** — circuit breaker trips silently. Should surface blocked state on the dashboard
4. **Old data gap (Jan 31 – Mar 15)** — 45 days will never be backfilled. Acceptable since we're building forward

## Gotchas Discovered

1. **Garmin `summary` endpoint returns 403** — may be a new API restriction. Steps still work via `client.getSteps()` (different endpoint)
2. **Garmin `bodyBattery` endpoint returns 404 for historical dates** — body battery data comes through the `stress` endpoint instead
3. **`api_usage_v2` query returns 406** when no row exists for today — non-critical, `getGarminDailyCallCount()` returns 0 correctly
4. **`trackServiceUsage` increments by 1 per call** — tracking 11 calls requires 11 sequential DB writes. Could optimize with batch increment

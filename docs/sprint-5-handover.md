# Sprint 5 Handover

**Prepared:** 2026-03-17
**Previous sprint:** Sprint 4 (Deploy + Cron + Health & Fitness)

---

## Current state

Jarvis is fully deployed to production at `https://jarvis-production-9aea.up.railway.app`. All sync operations run on automated schedules via cron-job.org. n8n has been fully eliminated.

### Production infrastructure
| Component | Details |
|-----------|---------|
| Hosting | Railway (Railpack builder, auto-deploy from GitHub) |
| URL | `jarvis-production-9aea.up.railway.app` |
| Database | Supabase (14 tables, RLS enabled) |
| Cron | cron-job.org (6 jobs) |
| Framework | Next.js 16 App Router + Turbopack |

### Connected accounts
| Service | Accounts |
|---------|----------|
| Microsoft (Outlook + Calendar) | filmanferdian@outlook.com |
| Google (Gmail + Calendar) | filmanferdian@gmail.com, [work account] |
| Google (Gmail only, excluded from Calendar) | filmanferdian21@gmail.com |
| Garmin Connect | filmanferdian@gmail.com |
| Apple Health (weight) | via iOS Shortcuts webhook |

### Cron schedules (cron-job.org, Asia/Jakarta timezone)
| Job | Schedule | Endpoint |
|-----|----------|----------|
| Google Calendar | `*/15 * * * *` | `/api/cron/google-calendar` |
| Outlook Calendar | `*/15 * * * *` | `/api/cron/outlook-calendar` |
| Notion Tasks | `*/30 * * * *` | `/api/cron/notion-tasks` |
| Email Synthesis | `0 7 * * *` | `/api/cron/email-synthesis` |
| Morning Briefing | `30 7 * * *` | `/api/cron/morning-briefing` |
| Garmin Sync | `0 8 * * *` | `/api/cron/garmin` |

All cron jobs use header `x-cron-secret` for authentication.

---

## API route inventory (31 routes)

### Auth routes
- `GET /api/auth/google` — Google OAuth start
- `GET /api/auth/google/callback` — Google OAuth callback
- `GET /api/auth/microsoft` — Microsoft OAuth start
- `GET /api/auth/microsoft/callback` — Microsoft OAuth callback

### Sync routes (manual, withAuth)
- `POST /api/sync` — Auto-sync dispatcher (debounced)
- `POST /api/sync/outlook` — Outlook calendar sync
- `POST /api/sync/google-calendar` — Google calendar sync
- `POST /api/sync/notion` — Notion tasks sync
- `POST /api/sync/emails` — Email synthesis
- `POST /api/sync/garmin` — Garmin daily sync

### Cron routes (withCronAuth)
- `GET /api/cron/google-calendar`
- `GET /api/cron/outlook-calendar`
- `GET /api/cron/notion-tasks`
- `GET /api/cron/email-synthesis`
- `GET /api/cron/morning-briefing`
- `GET /api/cron/garmin`

### Data routes
- `GET /api/calendar` — Calendar events
- `GET /api/tasks` — Notion tasks
- `GET /api/emails` — Email synthesis
- `GET /api/briefing` — Morning briefing
- `GET /api/health-fitness` — Garmin + weight data
- `GET /api/domains` — Domain KPIs

### Action routes
- `POST /api/briefing/regenerate` — Regenerate briefing
- `POST /api/health/weight` — Weight webhook (iOS Shortcuts)
- `POST /api/tts` — Text-to-speech

---

## Critical gotchas (carry forward)

1. **ANTHROPIC_API_KEY conflict** — Claude Code overrides `process.env.ANTHROPIC_API_KEY`. Always use `process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY`.
2. **Auth token shell escaping** — `JARVIS_USER_TOKEN` contains `!#@%$`. Use Python `urllib.request` for API testing, never curl.
3. **Dual .env.local** — Both repo root and worktree need `.env.local`. Sync after changes.
4. **Delete-then-insert** — Single-row-per-day tables use delete + insert, not upsert.
5. **Google OAuth** — Always use `prompt: 'consent'` to ensure all scopes granted.
6. **Railway port** — App listens on `$PORT` (8080). Domain networking must match.
7. **Garmin raw_json** — Always store raw API responses. Parse from real data.
8. **iOS Shortcuts payloads** — Accept multiple data formats (number, string, object) for webhook endpoints.
9. **WIB timezone** — All times use hardcoded offset `7 * 60 * 60 * 1000` (UTC+7).
10. **Garmin session auth** — `garmin-connect` uses session cookies, not OAuth. May need re-auth if Garmin changes anything.

---

## Suggested Sprint 5 scope

### P0 — Stability & Polish
- [ ] Monitor cron jobs for 1 week — check Supabase data freshness daily
- [ ] Add error alerting (cron failures → notification)
- [ ] Fix any HealthCard rendering issues found during mobile testing
- [ ] Google Calendar re-auth if tokens expire (refresh token flow)

### P1 — Cross-domain insights
- [ ] `/api/insights` — Claude analyzes across all domains (calendar + tasks + health + emails)
- [ ] InsightsCard.tsx — Weekly patterns, correlations (sleep vs productivity, etc.)
- [ ] Domain scoring — Automated health scores based on KPI targets

### P2 — UX improvements
- [ ] Dark mode / theme toggle
- [ ] Mobile-responsive layout improvements
- [ ] Notification preferences (which alerts to receive)
- [ ] Historical data views (week/month trends for health metrics)

### P3 — Data enrichment
- [ ] Garmin activity details (GPS tracks, splits, zones)
- [ ] Calendar analytics (meeting load, focus time blocks)
- [ ] Task completion trends from Notion
- [ ] Financial domain integration (if applicable)

---

## Env vars reference

All env vars needed in Railway / `.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JARVIS_ANTHROPIC_KEY` | Claude API key (⚠️ not ANTHROPIC_API_KEY) |
| `JARVIS_USER_TOKEN` | Bearer token for user auth |
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app client secret |
| `MICROSOFT_TENANT_ID` | Azure AD tenant (common) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_TASKS_DB` | Notion tasks database ID |
| `GARMIN_EMAIL` | Garmin Connect login email |
| `GARMIN_PASSWORD` | Garmin Connect login password |
| `CRON_SECRET` | Secret for cron job auth header |
| `NEXT_PUBLIC_APP_URL` | Production URL |

---

## Supabase tables (14)

| Table | Purpose | Migration |
|-------|---------|-----------|
| `domains` | Life domains (Health, Fitness, Career, etc.) | 001 |
| `domain_kpis` | KPI tracking per domain | 001 |
| `calendar_events` | Synced calendar events | 001 |
| `tasks` | Notion tasks | 001 |
| `email_synthesis` | Daily email summaries | 002 |
| `briefings` | Morning briefings | 002 |
| `microsoft_tokens` | Microsoft OAuth tokens | 003 |
| `google_tokens` | Google OAuth tokens | 004 |
| `sync_status` | Sync debouncing tracker | 005 |
| `garmin_daily` | Daily Garmin health metrics | 006 |
| `garmin_activities` | Garmin activities (runs, walks, etc.) | 006 |
| `weight_log` | Weight measurements from Apple Health | 006 |

---

## Notion page IDs for updates

| Page | ID |
|------|-----|
| Sprint logs | `322c674aecec8193954acb0648fbddb0` |
| Retrospective log | `322c674aecec81de9e85f5dceca130ae` |
| Project Jarvis | `322c674aecec81c2986cef59e388c8f4` |
| Delivery | `322c674aecec81b793d4d69e163b0a23` |

# Sprint 3 Handover

**Prepared:** 2026-03-16
**For:** Next Claude session continuing Jarvis development

---

## Repository state

- **Repo:** `github.com/filmanferdian/Jarvis`
- **Default branch:** `main` (all Sprint 2 code merged)
- **Latest commit:** Sprint 2 completion + n8n workflow fixes
- **Build status:** Clean (`npm run build` passes, all 13 API routes)

## Architecture

```
Next.js 16 App Router
├── src/app/page.tsx          — Main dashboard (TopBar, Sidebar, BriefingCard, ScheduleStrip, TasksCard, EmailCard, KpiRow, VoiceMic)
├── src/app/api/              — 13 API routes (all use withAuth middleware)
├── src/components/           — 10 components
├── src/lib/                  — supabase client, auth, fetchAuth, usePolling
├── n8n-workflows/            — Portable workflow JSONs
└── supabase/                 — Migration SQL files
```

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 16, Tailwind CSS | Dark theme, PWA, mobile-responsive |
| Backend | Next.js API routes | All behind `withAuth` (Bearer token) |
| Database | Supabase (PostgreSQL) | Service role key for server, anon key for client |
| AI | Claude claude-sonnet-4-20250514 | Briefing generation, email synthesis, voice intent |
| Automation | n8n (Railway) | 10 workflows, 2 Jarvis-specific |
| Tasks | Notion API | Direct CRUD from Next.js + n8n sync |
| Calendar | Google + Outlook | OAuth2 via n8n, 15-min sync |
| Voice | Web Speech API | STT (SpeechRecognition), TTS (SpeechSynthesis) |

## Credentials & Environment

All in `.env.local` (both main repo and worktrees need copies):

| Variable | Purpose |
|----------|---------|
| `JARVIS_AUTH_TOKEN` | Dashboard auth (Bearer token) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side) |
| `ANTHROPIC_API_KEY` | Claude API for briefing/synthesis/voice |
| `NOTION_API_KEY` | Notion internal integration token |
| `NOTION_DATABASE_ID` | Notion tasks database |
| `NOTION_TASKS_DB_ID` | Same as above (legacy alias) |

### External service URLs

| Service | URL |
|---------|-----|
| n8n | `https://n8nion8n-production-d73b.up.railway.app/` |
| Supabase | `https://voycxhchxtggncosfzuf.supabase.co` |
| Notion Tasks DB | `014c674a-ecec-8338-94f3-0134b85d8c94` |
| Notion Projects DB | `0a3c674a-ecec-8357-96c7-0129a693be3d` |

### n8n credential IDs (instance-specific)

| Credential | ID | Type |
|-----------|-----|------|
| Notion | `O2VFJDk6M2KG0aYM` | Notion Internal Integration |
| Supabase | `CK4gp6OFHzM0xCns` | Supabase API |
| Anthropic | `Gr32CPVOEbIOZK7M` | HTTP Header Auth |
| Google OAuth2 | `VQo95Gsxh2ibgi34` | Google Calendar + Gmail |

## Current domain integration status

| Domain | Data Source | Sync Method | Data in Supabase | Status |
|--------|-----------|-------------|------------------|--------|
| Google Calendar | Google OAuth2 | n8n every 15 min | 3 events | LIVE |
| Outlook Calendar | MS OAuth2 | n8n every 15 min | 0 events | NEEDS TESTING (OAuth may need refresh) |
| Claude Briefing | Anthropic API | n8n daily 07:30 + on-demand | 1 briefing | LIVE |
| Notion Tasks | Notion API | n8n every 30 min + direct CRUD | 22 tasks (16 active) | LIVE |
| Gmail Email | Gmail API | n8n daily 07:00 | 0 syntheses | NEEDS TESTING (Gmail creds) |
| Domain KPIs | Supabase | Manual seed | 10 KPIs (1/domain) | LIVE (needs auto-update) |
| Voice STT | Web Speech API | Client-side | N/A | BUILT (browser only) |
| Voice TTS | Web Speech API | Client-side | N/A | BUILT (upgrade to OpenAI planned) |

## What works right now

1. Auth gate + token login
2. Morning briefing card with TTS playback and regeneration
3. Calendar strip showing Google events
4. Notion tasks with quick-add and status toggle
5. Domain health ring in sidebar
6. KPI cards row with progress bars
7. Mobile hamburger menu
8. Auto-refresh polling (5 min) on all cards
9. Voice mic button (mobile only) with intent parsing
10. n8n Notion task sync every 30 minutes

## Known issues & tech debt

1. **Email synthesis workflow untested** — Gmail OAuth credential in n8n (`VQo95Gsxh2ibgi34`) is Google OAuth2, not Gmail-specific. May need testing.
2. **Outlook calendar sync** — OAuth token may need refresh. No events synced yet.
3. **Domain health_status** — Stored as null in `domains` table. API calculates dynamically, but sidebar uses API data. Works but could be pre-computed.
4. **Voice TTS** — Using browser Web Speech API. Quality varies by device. OpenAI TTS upgrade planned.
5. **Remove Stale Tasks** — n8n node currently a no-op (skipped). Stale cleanup handled by upsert overwrite. Add proper cleanup later.
6. **Rate limiting** — `api_usage` table exists but `checkRateLimit` may not be called on all routes.

## Sprint 3 proposed features

| Priority | Feature | Effort | Notes |
|----------|---------|--------|-------|
| P0 | Test & fix Email Synthesis e2e | Small | Verify Gmail OAuth, run workflow, check data |
| P0 | Test & fix Outlook calendar sync | Small | May just need OAuth token refresh |
| P1 | OpenAI TTS upgrade | Medium | Replace Web Speech API with OpenAI "onyx" voice |
| P1 | Direct API sync (reduce n8n) | Medium | Move Notion/Calendar sync to Next.js cron routes |
| P2 | Cross-domain insights | Large | Claude analyzes all domains, suggests actions |
| P2 | Automated alerts | Medium | Notify when KPI drops below threshold |
| P3 | Goal tracking | Medium | Weekly/monthly domain goals with progress |
| P3 | Weekly review generation | Medium | Auto-generate weekly summary across all domains |

## Rules for Sprint 3 (from retrospective)

1. **Always work on `main` branch** — merge feature work immediately
2. **Push to GitHub at end of every session** — no local-only commits
3. **Use HTTP Request nodes in n8n** — not Supabase/Code nodes for API calls
4. **Check existing data before seeding** — use upserts, not inserts
5. **Copy `.env.local` to worktrees** — worktrees don't inherit env files
6. **Test n8n workflows on live instance** — don't assume JSON imports work

## How to start Sprint 3

```bash
cd /Users/filmanferdiandev/Jarvis
git checkout main
git pull
npm run dev
# Visit http://localhost:3000
```

To test the dashboard:
1. Login with auth token from `.env.local`
2. Check briefing card loads
3. Check tasks show Notion data
4. Check calendar shows events
5. Try quick-adding a task
6. Try voice mic (mobile or Chrome DevTools mobile mode)

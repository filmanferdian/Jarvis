# Jarvis

A single-user personal assistant. Next.js 16 + TypeScript + Supabase + the Claude API, deployed on Railway.

Jarvis pulls a handful of personal data sources into one dashboard: calendar, tasks, email, news, fitness, and KPIs, plus a morning briefing and voice input. All times are WIB (UTC+7).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Requires a `.env.local` with Supabase, Claude, Google/Microsoft OAuth, Garmin, and `CRYPTO_KEY` values. Note that `CRYPTO_KEY` encrypts stored OAuth tokens and Garmin payloads at rest; rotating it invalidates all of them.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on localhost:3000 |
| `npm run build` | Production build; also validates TypeScript |
| `npm run start` | Production server (binds 0.0.0.0, uses `$PORT`) |

There is no test framework configured. Verify changes with `npm run build`.

## Layout

- `src/app/page.tsx` — dashboard, renders the cards
- `src/app/api/` — API routes by domain (auth, briefing, calendar, emails, fitness, tasks, voice, cron, …)
- `src/lib/` — shared server-side utilities
- `src/lib/sync/` — one module per integration (Google Calendar, Outlook, Garmin, Notion, email, news, contacts)
- `src/components/` — dashboard cards and shell
- `supabase/` — `migration-NNN-*.sql`, applied manually to production

## Scheduling

Cron runs on cron-job.org (Asia/Jakarta), which calls `GET /api/cron/*` with an `x-cron-secret` header. The `n8n-workflows/` directory is legacy and unused.

## Deployment

Railway deploys from `main`. Pushing to `main` triggers a deploy; the app listens on `$PORT`.

See `CLAUDE.md` for architecture notes, security posture, and versioning rules, and `CHANGELOG.md` for release history.

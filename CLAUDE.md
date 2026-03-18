# Jarvis — Project Instructions

## Architecture
- Next.js 16 + TypeScript + Supabase + Claude API
- Single-user personal assistant, deployed on Railway
- All times use WIB timezone (UTC+7), hardcoded offset `7 * 60 * 60 * 1000`
- Auth: httpOnly cookie (browser) + `x-cron-secret` header (external callers)

## Critical Gotchas
1. **ANTHROPIC_API_KEY conflict** — Always use `JARVIS_ANTHROPIC_KEY || ANTHROPIC_API_KEY`
2. **Dual .env.local** — Both repo root and worktree need `.env.local`
3. **Delete-then-insert** — Single-row-per-day tables use delete + insert pattern
4. **Google OAuth** — Always use `prompt: 'consent'`
5. **Railway port** — App listens on `$PORT` (8080)
6. **Garmin raw_json** — Always store raw API responses
7. **Cookie auth** — Browser uses httpOnly cookie, external callers use `x-cron-secret` header

## Sprint Definition of Done
Before closing any sprint, ALL of the following must be complete:
1. **Code Integration** — All feature branches merged to `main`. No dangling branches.
2. **Working Product** — Deployed to Railway, verified on desktop + mobile.
3. **Retrospective** — Written in `docs/sprint-X-retrospective.md`
4. **Handover** — Written in `docs/sprint-X+1-handover.md`
5. **Notion Updated** — Sprint logs, Retrospective log, Project Jarvis, Delivery pages
6. **Migration Applied** — Production Supabase schema in sync

## Notion Page IDs
- Sprint logs: `322c674aecec8193954acb0648fbddb0`
- Retrospective log: `322c674aecec81de9e85f5dceca130ae`
- Project Jarvis: `322c674aecec81c2986cef59e388c8f4`
- Delivery: `322c674aecec81b793d4d69e163b0a23`

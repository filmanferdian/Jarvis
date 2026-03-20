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

## Versioning Discipline
- Version lives in `package.json` (single source of truth). `src/lib/version.ts` reads from it automatically.
- **Every push to main that triggers a Railway deploy MUST bump the version in `package.json`.**
- Use semver: `major.sprint.patch` (e.g., `1.8.3`). Bump patch for every deploy within a sprint.
- Include the version bump in the same commit or as a separate `chore: bump version to vX.Y.Z` commit.
- Never push to main without updating the version — the dashboard header shows it.

## Branch Discipline
- Railway deploys from `main`. Never point it at a worktree branch.
- Every Claude Code session MUST merge its worktree branch to `main` and push before ending.
- Never leave working code on a side branch. If the session is interrupted, the next session's first task is to merge pending worktree work into main.
- After merging, push to origin/main immediately so Railway deploys.
- Clean up old worktree branches periodically.

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

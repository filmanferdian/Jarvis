# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build (also validates TypeScript)
- `npm run start` — production server (binds 0.0.0.0, uses `$PORT`)
- No test framework configured; verify changes with `npm run build`

## Architecture
- Next.js 16 + TypeScript + Supabase + Claude API
- Single-user personal assistant ("Jarvis"), deployed on Railway
- All times use WIB timezone (UTC+7), hardcoded offset `7 * 60 * 60 * 1000`
- Auth: httpOnly cookie (browser) + `x-cron-secret` header (external callers)

### Code Structure
- `src/app/page.tsx` — Dashboard (client component), renders cards: Briefing, Schedule, Tasks, Email, News, Fitness, KPIs, Voice
- `src/app/api/` — API routes organized by domain (auth, briefing, calendar, contacts, cron, emails, fitness, health, sync, tasks, voice, etc.)
- `src/lib/` — Shared server-side utilities
- `src/lib/sync/` — Data sync modules (one per integration: Google Calendar, Outlook, Garmin, Notion tasks/context, email, fitness, news, contacts)
- `src/components/` — React components (dashboard cards, AppShell, Sidebar, TopBar, VoiceMic)
- `src/contexts/` — React contexts (SpeakingContext for TTS state)
- `supabase/` — Migration files (`migration-NNN-*.sql`), applied to production Supabase
- `n8n-workflows/` — Exported n8n workflow JSON files (cron orchestration)
- `scripts/` — One-off utility scripts (backfill, seed)

### Key Patterns
- **Auth wrappers**: `withAuth()` (cookie/bearer for browser) and `withCronAuth()` (x-cron-secret for n8n/external)
- **Supabase client**: Lazy-initialized singleton via Proxy in `src/lib/supabase.ts` (build-safe; no env vars needed at build time)
- **Jarvis context**: `src/lib/context.ts` builds AI system prompts from Notion-synced context pages stored in `notion_context` table
- **Sync tracker**: `src/lib/syncTracker.ts` — `shouldSync(type, interval)` / `markSynced()` prevents duplicate syncs
- **Cron logging**: `src/lib/cronLog.ts` — all cron jobs log to `cron_run_log` table
- **Middleware**: `src/middleware.ts` — rate limiting (login, weight, voice) + Content-Type enforcement on API mutations

### Migrations
- Files in `supabase/` named `migration-NNN-*.sql`, numbered sequentially
- Apply manually to production Supabase (no CLI migration runner)

## Critical Gotchas
1. **ANTHROPIC_API_KEY conflict** — Always use `JARVIS_ANTHROPIC_KEY || ANTHROPIC_API_KEY`
2. **Dual .env.local** — Both repo root and worktree need `.env.local`
3. **Delete-then-insert** — Single-row-per-day tables use delete + insert pattern
4. **Google OAuth** — Always use `prompt: 'consent'`
5. **Railway port** — App listens on `$PORT` (8080)
6. **Garmin raw_json** — Always store raw API responses (now AES-GCM encrypted at rest via `src/lib/crypto.ts`; unwrap with `unwrapJsonb()`)
7. **Cookie auth** — Browser uses httpOnly cookie, external callers use `x-cron-secret` header
8. **`CRYPTO_KEY` required** — Sensitive columns (`google_tokens`, `microsoft_tokens`, `garmin_tokens.tokens_encrypted`, `garmin_*.raw_json`) are encrypted with this key. Generate once with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and keep in Railway + .env.local. Rotating it invalidates all stored OAuth tokens and raw_json — treat as break-glass.
9. **Garmin uses username/password, not OAuth** — Garmin Connect has no public OAuth. `GARMIN_EMAIL` / `GARMIN_PASSWORD` are top-tier secrets: never log them, never echo from Railway build logs, never print error details that might include the request payload.

## Security posture
- **Prompt injection defense**: all externally-sourced text (emails, calendar events, tasks, transcripts, newsletters) must go through `sanitizeInline`/`sanitizeMultiline` from `src/lib/promptEscape.ts` and be wrapped with `wrapUntrusted(tag, content)` before embedding in Claude prompts. Include the `UNTRUSTED_PREAMBLE` near the top of the system prompt.
- **XSS defense**: Claude-generated markdown is HTML-escaped before any regex substitutions in `src/lib/renderMarkdown.ts`. Do NOT add regex substitutions that produce HTML tags from user-controlled capture groups without re-escaping.
- **OAuth state**: `/api/auth/google` and `/api/auth/microsoft` generate signed state tokens via `src/lib/oauthState.ts`; callbacks reject mismatched state. Always use `buildAuthUrl(state)` (never the no-arg form) when adding new OAuth integrations.
- **API error responses**: route every non-trivial catch through `safeError()` from `src/lib/errors.ts`. Never return `err.message` / `String(err)` / Supabase `error.message` to the client — log server-side, return a generic message.

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

## Ghostwriting Style Guide
Filman's email communication style, derived from analysis of 129 sent emails. Full guide is in Notion (`32dc674aecec817198f2ead59e09873c`) and synced to Jarvis context as the `ghostwriting` page key.

Key patterns:
- **Internal team**: Casual, direct, heavy Indonesian. "Ok, proceed aja with both." "Approved and released ya."
- **External partners**: Professional but friendly. "Hi [Name]," + full signature. "Would be great to discuss."
- **Investors**: Most formal, personal, longer context. Always full signature with phone number.
- **Language**: 95% English for external. Indonesian particles ("ya", "aja") for internal. Mixed in casual contexts.
- **Structure**: Short paragraphs (1-3 sentences). Direct. Front-loads key information. Minimal formatting.
- **Closings**: "Best regards, Filman Ferdian / Co-founder & CEO of Infinid / +62 811 1011 580"
- **Actionability**: Direct commands internally, polite requests externally. Clear next steps always.

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Identifiers
- Notion workspace: Pijar
- Notion pages:
  - Sprint logs: `322c674aecec8193954acb0648fbddb0`
  - Retrospective log: `322c674aecec81de9e85f5dceca130ae`
  - Project Jarvis: `322c674aecec81c2986cef59e388c8f4`
  - Delivery: `322c674aecec81b793d4d69e163b0a23`
  - Ghostwriting style guide: `32dc674aecec817198f2ead59e09873c`

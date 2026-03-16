# Sprint 2 Retrospective

**Sprint dates:** 2026-03-10 to 2026-03-16
**Status:** Complete

---

## What was delivered

| Feature | Route/Component | Status |
|---------|----------------|--------|
| Tasks Card (Notion CRUD) | `TasksCard.tsx`, `/api/tasks/create`, `/api/tasks/update` | Live |
| Email Digest Card | `EmailCard.tsx`, `/api/emails`, `/api/emails/synthesize` | Built (needs Gmail creds in n8n) |
| Domain Health Sidebar | `Sidebar.tsx` with SVG donut ring, `/api/domains` | Live |
| Notion Migration | `notion_tasks` table, n8n workflow | Live + syncing |
| Email Synthesis Pipeline | n8n workflow `Jarvis — Email Synthesis` | Built (needs testing) |
| Auto-Refresh Polling | `usePolling` hook on all 4 cards | Live |
| Mobile UX | Hamburger menu, slide-in sidebar | Live |
| Auth Improvements | `AuthGate.tsx` server validation | Live |
| Briefing Regeneration | `/api/briefing/regenerate`, BriefingCard refresh button | Live |
| KPI Cards | `KpiRow.tsx`, `/api/kpis` | Live |
| CSS Health Ring | SVG donut in Sidebar | Live |
| Voice Input (STT + intent) | `VoiceMic.tsx`, `Toast.tsx`, `/api/voice/intent` | Built |

## What went well

1. **Feature velocity** — 12 features delivered in one sprint, including full Notion integration with bidirectional sync
2. **n8n integration** — Successfully imported and debugged 2 automated workflows (Notion sync, Email synthesis)
3. **Architecture** — `usePolling` hook pattern enabled consistent auto-refresh across all cards with minimal code
4. **PWA support** — Standalone mode with proper auth gate works well on mobile

## What went wrong

### 1. Code scattered across branches and worktrees
**Impact:** High. Wasted significant time auditing 4 local branches, 3 remote branches, and multiple worktrees to locate Sprint 2 work.
**Root cause:** Sprint 2 work was done across multiple Claude sessions, each creating its own branch (`claude/jarvis-sprint-1-start-Qvgc4`, `claude/quizzical-poitras`, etc). No single source of truth.
**Fix for Sprint 3:** Always work on `main` branch. Cherry-pick from feature branches if needed, but merge immediately. Push to GitHub after each session.

### 2. Sprint 2 commits never pushed to GitHub
**Impact:** Medium. 3 Sprint 2 commits existed only locally on a branch. Risk of data loss.
**Root cause:** Claude sessions ended without pushing. No CLAUDE.md rule about pushing.
**Fix for Sprint 3:** Add to handover checklist: "push all commits before session ends."

### 3. n8n Supabase node incompatibility
**Impact:** Medium. The n8n Supabase node `executeQuery` operation requires a `tableId` parameter in v2.11.4 that wasn't set in the imported workflow.
**Root cause:** Workflow JSON was authored targeting an older n8n node version. No testing against the live n8n instance before deploying.
**Fix for Sprint 3:** Use HTTP Request nodes for Supabase operations instead of the native Supabase node. More portable and predictable.

### 4. n8n Code node restrictions
**Impact:** Low-medium. `fetch`, `axios`, and `$http` are all unavailable in n8n Code nodes by default.
**Root cause:** Assumed Code nodes had network access. n8n sandboxes them.
**Fix for Sprint 3:** For any n8n node that needs to call external APIs, use HTTP Request nodes instead of Code nodes.

### 5. Duplicate KPI seeds
**Impact:** Low. Two separate sessions seeded 10 KPIs each, creating 20 duplicates.
**Root cause:** No idempotency check before seeding.
**Fix for Sprint 3:** Always check existing data before seeding. Use upsert with unique constraints.

### 6. No default `main` branch on GitHub
**Impact:** Low. The GitHub repo's default branch was `claude/jarvis-sprint-1-start-Qvgc4` instead of `main`.
**Root cause:** First push was to a Claude-generated branch name.
**Fix:** Resolved — `main` is now the default branch.

## Key metrics

- **API routes:** 13 (all passing build)
- **Notion tasks synced:** 22 (16 active, 6 done/archived)
- **Calendar events:** 3 (Google only — Outlook sync needs OAuth refresh)
- **Briefings generated:** 1 (2026-03-16)
- **Email syntheses:** 0 (workflow built, needs Gmail creds testing)
- **KPIs seeded:** 10 (1 per domain)
- **n8n workflows:** 2 new (10 total)

## Domain health (as of 2026-03-16)

All 10 domains exist in `domains` table but `health_status` and `last_synced` are null — the domain health API (`/api/domains`) calculates health dynamically from data freshness, not from stored values.

---

## Action items for Sprint 3

1. Test Email Synthesis workflow end-to-end with Gmail OAuth
2. Test Outlook calendar sync (may need OAuth token refresh)
3. Implement OpenAI TTS to replace Web Speech API
4. Add direct API sync option to reduce n8n dependency
5. Build cross-domain insights engine

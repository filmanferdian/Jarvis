# Sprint 4 Handover

**Prepared:** 2026-03-17
**For:** Next Claude session continuing Jarvis development

---

## Repository state

- **Repo:** `github.com/filmanferdian/Jarvis`
- **Working branch:** `claude/zen-tu` (worktree at `.claude/worktrees/zen-tu/`)
- **Latest commit:** Sprint 3 completion (22 API routes, all passing build)
- **Build status:** Clean (`npm run build` passes)

## Architecture

```
Next.js 16 App Router (Turbopack)
├── src/app/page.tsx              — Main dashboard
├── src/app/api/                  — 22 API routes
│   ├── auth/microsoft/           — Microsoft OAuth start + callback
│   ├── auth/google/              — Google OAuth start + callback
│   ├── sync/outlook/             — Outlook calendar sync (Graph API)
│   ├── sync/emails/              — Unified email synthesis (4 inboxes → Claude)
│   ├── sync/notion/              — Direct Notion task sync
│   ├── tts/                      — OpenAI TTS (tts-1, onyx voice)
│   ├── briefing/                 — Morning briefing (fetch + regenerate)
│   ├── calendar/                 — Today's events (read from Supabase)
│   ├── tasks/                    — Task CRUD (Notion API)
│   ├── emails/                   — Email synthesis (read + manual synthesize)
│   ├── voice/intent/             — Voice STT → Claude intent parsing
│   ├── domains/                  — Domain health status
│   ├── kpis/                     — KPI CRUD
│   └── health/                   — Health check
├── src/components/               — 10 components
├── src/lib/                      — Shared libs
│   ├── microsoft.ts              — Microsoft OAuth + Graph API client
│   ├── google.ts                 — Google OAuth + Gmail API client
│   ├── supabase.ts               — Supabase client
│   ├── auth.ts                   — withAuth middleware
│   ├── rateLimit.ts              — API usage tracking
│   ├── fetchAuth.ts              — Client-side auth fetch helper
│   └── usePolling.ts             — Auto-refresh hook
├── n8n-workflows/                — 5 workflow JSONs (backup/reference)
└── supabase/                     — 4 migration SQL files
```

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 16, Tailwind CSS | Dark theme, PWA, mobile-responsive |
| Backend | Next.js API routes | All behind `withAuth` (Bearer token) |
| Database | Supabase (PostgreSQL) | 11 tables, service role key for server |
| AI | Claude claude-sonnet-4-20250514 | Briefing, email synthesis, voice intent |
| TTS | OpenAI tts-1 | Onyx voice, MP3, with Web Speech fallback |
| Automation | n8n (Railway) | Google Calendar sync, Notion backup, briefing cron |
| Tasks | Notion API | Direct CRUD + n8n background sync |
| Calendar | Microsoft Graph + Google Calendar | OAuth2 direct + n8n |
| Email | Microsoft Graph + Gmail API | 4 accounts, unified synthesis |

## Connected accounts

| Account | Provider | Method | Status |
|---------|----------|--------|--------|
| `filman@infinid.id` | Microsoft (Outlook) | Direct OAuth2 | ✅ Active |
| `filman@group.infinid.id` | Google Workspace | Direct OAuth2 | ✅ Active |
| `filmanferdian@gmail.com` | Gmail | Direct OAuth2 | ✅ Active |
| `filmanferdian21@gmail.com` | Gmail | Direct OAuth2 | ✅ Active |

## Environment Variables

All in `.env.local` (MUST exist in both repo root AND worktree):

| Variable | Purpose |
|----------|---------|
| `JARVIS_AUTH_TOKEN` | Dashboard auth (Bearer token). Contains shell-hostile chars — use Python for testing. |
| `JARVIS_ANTHROPIC_KEY` | Claude API key. **MUST use this, not ANTHROPIC_API_KEY** (Claude Code overrides it). |
| `ANTHROPIC_API_KEY` | Same key, backup. Overridden at runtime by Claude Code. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side) |
| `NOTION_API_KEY` | Notion internal integration token |
| `NOTION_TASKS_DB_ID` | Notion tasks database ID |
| `MICROSOFT_CLIENT_ID` | Azure AD app registration |
| `MICROSOFT_CLIENT_SECRET` | Azure AD client secret |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth secret |
| `OPENAI_API_KEY` | OpenAI API key (TTS) |
| `NEXT_PUBLIC_APP_URL` | App URL for OAuth callbacks (`http://localhost:3000`) |

## Critical gotchas for future sessions

1. **NEVER use `process.env.ANTHROPIC_API_KEY` directly** — Claude Code runtime overrides it. Always use `process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY`.
2. **NEVER use curl to test Jarvis APIs** — auth token has `!#@%$` chars that break bash escaping. Use Python `urllib.request` instead.
3. **Always sync both `.env.local` files** — worktree at `.claude/worktrees/zen-tu/.env.local` AND root at `Jarvis/.env.local`. Next.js Turbopack loads from worktree dir.
4. **Delete-then-insert for daily tables** — `email_synthesis` and similar single-row-per-day tables should use DELETE+INSERT, not upsert.
5. **Google OAuth needs `prompt: 'consent'`** — ensures all scopes are granted on re-auth.
6. **Microsoft OAuth uses `/common/` endpoint** — works for both work and personal accounts.
7. **All times in WIB (UTC+7)** — hardcoded offset `7 * 60 * 60 * 1000` used throughout.

## Supabase tables (11)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `domains` | 10 life domains | name, alert_threshold_days, is_active |
| `domain_kpis` | KPI per domain | domain_id, kpi_name, kpi_value, kpi_target, trend |
| `briefing_cache` | Daily morning briefing | date (unique), briefing_text |
| `calendar_events` | Google + Outlook events | event_id (unique), title, start/end_time, source |
| `notion_tasks` | Tasks from Notion | notion_page_id (unique), name, due_date, priority, status |
| `email_synthesis` | Daily email summary | date, synthesis_text, important_count, deadline_count |
| `voice_log` | Voice transcripts | transcript, intent, response_text |
| `api_usage` | Rate limit tracking | date, call_count |
| `microsoft_tokens` | Microsoft OAuth tokens | id='default', access/refresh_token, expires_at |
| `google_tokens` | Google OAuth tokens (multi) | id (email-based), email, access/refresh_token |
| `top_kpis` | KPI display order | deprecated, not used |

## Sprint 4 proposed features

### P0 — Ship to production
| Feature | Effort | Notes |
|---------|--------|-------|
| Deploy to Railway | Medium | Next.js app + env vars. Update OAuth redirect URIs to production URL. |
| Cron jobs (replace n8n) | Medium | Move Google Calendar sync, Notion sync, morning briefing, email synthesis to Next.js cron routes or Railway cron. |
| Auto-sync on dashboard load | Small | Trigger sync endpoints when user opens dashboard (debounced). |

### P1 — Deepen domain integrations
| Feature | Domain | Effort | Notes |
|---------|--------|--------|-------|
| Health & Fitness tracking | Health, Fitness | Large | Apple Health / Google Fit API, or manual logging. Steps, sleep, workouts. |
| Financial dashboard | Wealth | Large | Bank API (if available) or manual input. Budget tracking, spending categories. |
| Learning tracker | Learning | Medium | Track books, courses, articles. Goodreads API or manual. |
| Spiritual habit tracker | Spiritual | Small | Daily check-in (meditation, prayer, gratitude). Simple toggle UI. |
| Family touchpoint tracker | Family | Small | Log last contact with family members. Alert when overdue. |
| Networking CRM | Networking | Medium | Track contacts, last interaction, follow-up reminders. |
| Personal branding metrics | Personal branding | Medium | LinkedIn/Twitter follower counts, post frequency. |
| Side project tracker | Side projects | Small | Link to GitHub repos, track commits/activity. |

### P2 — Intelligence layer
| Feature | Effort | Notes |
|---------|--------|-------|
| Cross-domain insights | Large | Claude analyzes all domains weekly, suggests actions |
| Weekly review generation | Medium | Auto-generate PDF/email summary of the week |
| Smart alerts | Medium | Push notifications when KPI drops or domain goes red |
| Goal setting & tracking | Medium | Weekly/monthly targets per domain with progress |

### P3 — UX polish
| Feature | Effort | Notes |
|---------|--------|-------|
| Dashboard customization | Medium | Drag-and-drop card ordering, show/hide domains |
| Dark/light theme toggle | Small | Currently dark only |
| Desktop notifications | Small | Browser push for alerts |
| Keyboard shortcuts | Small | Quick actions without clicking |

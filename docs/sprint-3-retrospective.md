# Sprint 3 Retrospective

**Sprint dates:** 2026-03-16 to 2026-03-17
**Status:** Complete

---

## What was delivered

| Feature | Route/Component | Status |
|---------|----------------|--------|
| Direct Microsoft OAuth2 flow | `/api/auth/microsoft`, `/api/auth/microsoft/callback`, `src/lib/microsoft.ts` | Live |
| Outlook Calendar Sync (direct) | `/api/sync/outlook` via Microsoft Graph API | Live (6 events synced) |
| Outlook Email Fetch (direct) | `/api/sync/emails` via Microsoft Graph `/me/messages` | Live (30 emails fetched) |
| Direct Google OAuth2 flow | `/api/auth/google`, `/api/auth/google/callback`, `src/lib/google.ts` | Live |
| Gmail Multi-Account Support | 3 Gmail accounts connected via single OAuth client | Live |
| Unified Email Synthesis | `/api/sync/emails` — 4 inboxes → Claude summary | Live (64 emails → synthesis) |
| OpenAI TTS | `/api/tts` (tts-1 model, onyx voice) | Live |
| TTS with fallback | `TTSButton.tsx` — OpenAI primary, Web Speech fallback | Live |
| Notion Direct Sync | `/api/sync/notion` with manual trigger button | Live |
| ANTHROPIC_API_KEY fix | All routes use `JARVIS_ANTHROPIC_KEY` to avoid Claude Code conflict | Live |
| n8n workflow fixes | 3 workflows updated: Supabase nodes → HTTP Request | Fixed |
| Supabase migrations | `microsoft_tokens` (003), `google_tokens` (004) | Applied |

## What went well

1. **n8n bypass was the right call** — Direct Next.js integration eliminated credential incompatibilities (n8n's Outlook node didn't support custom Azure app IDs, Gmail OAuth credential kept failing). Total control over auth flow.
2. **Multi-account Google OAuth** — One OAuth client serving 3 Gmail accounts with separate token rows. Clean architecture.
3. **Fast turnaround** — All P0 and P1 features delivered in one sprint day. From "n8n doesn't work" to "64 emails from 4 inboxes synthesized by Claude."
4. **Debug methodology** — The ANTHROPIC_API_KEY conflict was found by enumerating process.env keys via health endpoint. Systematic approach saved hours.

## What went wrong

### 1. Claude Code overrides ANTHROPIC_API_KEY at runtime
**Impact:** High. All Claude API calls returned `x-api-key header is required` because Claude Code's own runtime injects its API key into `process.env.ANTHROPIC_API_KEY`, overwriting the `.env.local` value.
**Root cause:** Claude Code sets environment variables for its own use that collide with common env var names.
**Fix applied:** Created `JARVIS_ANTHROPIC_KEY` env var. All 4 routes updated to use `process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY`.
**Lesson for future sessions:** Never use `ANTHROPIC_API_KEY` directly in Jarvis code. Always read `JARVIS_ANTHROPIC_KEY` first. This is critical when running `npm run dev` inside a Claude Code session.

### 2. n8n Microsoft Outlook credential doesn't support custom Azure app IDs
**Impact:** High. The entire Sprint 3 plan was originally to test/fix n8n workflows. Had to pivot to direct integration.
**Root cause:** n8n's built-in "Microsoft Outlook" credential type only supports Microsoft's own app registration. No field for custom Client ID/Secret.
**Fix applied:** Bypassed n8n entirely for Outlook. Built direct Microsoft Graph API integration in Next.js.
**Lesson for future sessions:** Don't assume n8n credentials support all OAuth configurations. Check credential UI fields before planning around them.

### 3. n8n Gmail OAuth credential fails silently
**Impact:** Medium. Email synthesis workflow couldn't run because the Gmail credential (`VQo95Gsxh2ibgi34`) showed a permissions error.
**Root cause:** Google OAuth2 credential in n8n was configured for Calendar scope, not Gmail scope.
**Fix applied:** Bypassed n8n for email too. Built direct Gmail API integration with multi-account support.
**Lesson for future sessions:** n8n is good for simple automations, but complex multi-account OAuth is better handled directly.

### 4. Supabase upsert fails without unique constraint
**Impact:** Low. `/api/sync/emails` tried to upsert on `email_synthesis.date` but got a conflict error.
**Root cause:** The `date` UNIQUE constraint from migration-002 may not have been applied, or Supabase upsert syntax requires explicit constraint naming.
**Fix applied:** Changed from upsert to delete-then-insert pattern.
**Lesson for future sessions:** Always use delete-then-insert for single-row-per-day tables. It's more reliable than upsert.

### 5. curl can't escape JARVIS_AUTH_TOKEN special characters
**Impact:** Low but annoying. The auth token `63SFCV7Gn!mV#Cf@a%W$` contains `!`, `#`, `@`, `%`, `$` — impossible to escape properly in bash single or double quotes.
**Root cause:** Token was randomly generated with too many shell-special characters.
**Fix applied:** Used Python `urllib.request` for all API testing instead of curl.
**Lesson for future sessions:** Always use Python for API testing in Jarvis. The auth token is hostile to shell escaping.

### 6. Google OAuth redirect URI field confusion
**Impact:** Low. User initially put callback URL in "Authorized JavaScript origins" instead of "Authorized redirect URIs".
**Root cause:** Google Cloud Console UI isn't intuitive about the distinction.
**Lesson for future sessions:** Origins = domain only (e.g., `http://localhost:3000`). Redirect URIs = full path (e.g., `http://localhost:3000/api/auth/google/callback`).

### 7. Google OAuth scope not granted on first auth
**Impact:** Low. One Gmail account (`filmanferdian21@gmail.com`) returned 403 "insufficient scopes" on first connect.
**Root cause:** User may not have checked the gmail.readonly permission checkbox during consent.
**Fix applied:** Re-authorized the account. Using `prompt: 'consent'` in auth URL ensures consent screen always shows.
**Lesson for future sessions:** Always use `prompt: 'consent'` for Google OAuth to ensure all scopes are granted.

## Key metrics

- **API routes:** 22 (was 13 in Sprint 2)
- **New routes this sprint:** 9 (4 auth + 3 sync + 1 TTS + 1 existing fix)
- **New libraries:** 2 (`microsoft.ts`, `google.ts`)
- **Lines added:** ~1,433
- **Connected accounts:** 4 (1 Outlook + 3 Gmail)
- **Emails fetched:** 64 across all accounts
- **Calendar events synced:** 6 (Outlook direct)
- **TTS audio generated:** 92KB MP3 in 3.3s
- **n8n dependency:** Reduced (calendar sync, email synthesis, Outlook all now direct)

## Sprint 3 action items resolved

| Item from Sprint 2 | Resolution |
|---|---|
| Test Email Synthesis e2e | ✅ Bypassed n8n, built direct integration. 64 emails synthesized. |
| Test Outlook calendar sync | ✅ Bypassed n8n, built direct Graph API integration. 6 events synced. |
| Implement OpenAI TTS | ✅ `/api/tts` with tts-1/onyx. Fallback to Web Speech API. |
| Add direct API sync option | ✅ All 3 sync endpoints now direct (Outlook, Email, Notion). |
| Build cross-domain insights | ❌ Deferred to Sprint 4. |

---

## Architecture evolution

**Before Sprint 3 (n8n-dependent):**
```
Google Calendar → n8n → Supabase
Outlook Calendar → n8n → Supabase (broken)
Gmail → n8n → Claude → Supabase (broken)
Notion → n8n → Supabase
```

**After Sprint 3 (direct integration):**
```
Outlook Calendar → Next.js /api/sync/outlook → Microsoft Graph → Supabase
Outlook Email → Next.js /api/sync/emails → Microsoft Graph → Claude → Supabase
Gmail (×3) → Next.js /api/sync/emails → Gmail API → Claude → Supabase
Notion → Next.js /api/sync/notion → Notion API → Supabase
Google Calendar → n8n → Supabase (still via n8n, works fine)
TTS → Next.js /api/tts → OpenAI API → MP3 audio
```

n8n is now only used for: Google Calendar sync (15-min cron), Notion sync backup (30-min cron), and Morning Briefing generation (daily 07:30 WIB).

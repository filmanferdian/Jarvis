# Sprint 7 Handover

**Prepared:** 2026-03-18
**Previous sprint:** Sprint 6 (Voice & Briefing Overhaul + Transformation Intelligence)

---

## What was delivered in Sprint 6

### Voice & TTS
| Feature | Files | Status |
|---------|-------|--------|
| ElevenLabs TTS (primary, OpenAI fallback) | `src/app/api/tts/route.ts` | Done |
| Dual voice toggle (Paul/Morgan) | `src/components/BriefingCard.tsx`, `src/components/TTSButton.tsx`, `src/app/api/tts/route.ts` | Done |
| Streaming audio playback (non-iOS) | `src/components/TTSButton.tsx` | Done |
| Mobile Safari stop fix | `src/components/TTSButton.tsx` | Done |
| VoiceMic cancel during processing | `src/components/VoiceMic.tsx` | Done |

### Briefing & Email
| Feature | Files | Status |
|---------|-------|--------|
| Dual-script briefing (written + voiceover) | `src/app/api/briefing/regenerate/route.ts`, `src/app/api/briefing/route.ts` | Done |
| Dual-script email synthesis | `src/app/api/emails/synthesize/route.ts`, `src/app/api/emails/route.ts` | Done |
| BriefingCard wired to voiceover for TTS | `src/components/BriefingCard.tsx` | Done |

### Transformation Intelligence
| Feature | Files | Status |
|---------|-------|--------|
| D1: Change detection alerts (48h) | `src/app/api/briefing/regenerate/route.ts` | Done |
| D2: Phase-aware briefing (transition warnings) | `src/app/api/briefing/regenerate/route.ts` | Done |
| D3: Planned vs actual workout adherence | `src/app/api/briefing/regenerate/route.ts` | Done |
| D4: Milestone tracker (weight vs target) | `src/app/api/briefing/regenerate/route.ts` | Done |
| D5: Recovery-aware suggestions | `src/app/api/briefing/regenerate/route.ts` | Done |
| D6: Biweekly check-in prompt | `src/app/api/briefing/regenerate/route.ts` | Done |

### Dashboard Cleanup
| Feature | Files | Status |
|---------|-------|--------|
| Task blacklist filter | `src/app/api/tasks/route.ts` | Done |
| Notion sync stale task cleanup | `src/app/api/sync/notion/route.ts` | Done |

---

## New/modified files

| File | Purpose |
|------|---------|
| `src/app/api/tts/route.ts` | ElevenLabs TTS with dual voice, streaming, OpenAI fallback |
| `src/app/api/briefing/regenerate/route.ts` | Dual-script generation + 6 transformation intelligence features |
| `src/app/api/briefing/route.ts` | Returns voiceover field |
| `src/app/api/emails/synthesize/route.ts` | Dual-script email synthesis |
| `src/app/api/emails/route.ts` | Returns voiceover field |
| `src/app/api/tasks/route.ts` | Task blacklist filter |
| `src/app/api/sync/notion/route.ts` | Stale task deletion |
| `src/components/TTSButton.tsx` | Streaming playback, iOS detection, AbortController, mobile stop fix |
| `src/components/VoiceMic.tsx` | Cancel during processing, AbortController |
| `src/components/BriefingCard.tsx` | Voice toggle (Paul/Morgan), voiceover wiring |
| `src/lib/validation.ts` | TTS max length increased to 5000 |
| `supabase/migration-009-sprint6.sql` | voiceover_text columns |
| `CLAUDE.md` | Sprint DoD added (project root) |

---

## New environment variables

| Variable | Purpose |
|----------|---------|
| `ELEVENLABS_API_KEY` | ElevenLabs API authentication |
| `ELEVENLABS_VOICE_ID` | Voice 1 (Paul) |
| `ELEVENLABS_VOICE_ID_2` | Voice 2 (Morgan) |
| `ELEVENLABS_MODEL_ID` | Optional, defaults to `eleven_multilingual_v2` |

---

## Migration applied

`supabase/migration-009-sprint6.sql` — adds `voiceover_text TEXT` to `briefing_cache` and `email_synthesis`.

---

## Critical gotchas (carry forward)

1. **ANTHROPIC_API_KEY conflict** — Use `JARVIS_ANTHROPIC_KEY || ANTHROPIC_API_KEY`.
2. **Dual .env.local** — Both repo root and worktree need `.env.local`.
3. **Delete-then-insert** — Single-row-per-day tables use delete + insert.
4. **Google OAuth** — Always use `prompt: 'consent'`.
5. **Railway port** — App listens on `$PORT` (8080).
6. **Garmin raw_json** — Always store raw API responses.
7. **iOS Shortcuts payloads** — Accept multiple data formats.
8. **WIB timezone** — All times use hardcoded offset `7 * 60 * 60 * 1000` (UTC+7).
9. **Cookie auth** — Browser uses httpOnly cookie, external callers use `x-cron-secret` header.
10. **Next.js 16 middleware warning** — Still works but may need migration.
11. **ElevenLabs fallback** — If `ELEVENLABS_API_KEY` is missing, TTS falls back to OpenAI `tts-1-hd` automatically.
12. **Dual-script splitting** — If Claude doesn't produce `===VOICEOVER===` delimiter, the full output is used as both written and voiceover (graceful degradation).
13. **ElevenLabs credits** — Starter plan is 30k chars/month. ~2,500 chars per briefing. Monitor usage.
14. **Branch discipline** — Railway deploys from `main` only. Every session must merge worktree to main and push before ending. See CLAUDE.md.

---

## Notion page IDs for updates

| Page | ID |
|------|-----|
| Sprint logs | `322c674aecec8193954acb0648fbddb0` |
| Retrospective log | `322c674aecec81de9e85f5dceca130ae` |
| Project Jarvis | `322c674aecec81c2986cef59e388c8f4` |
| Delivery | `322c674aecec81b793d4d69e163b0a23` |

---

## Sprint 7 candidates

### P0 — Fixes from Sprint 6 testing
- Fix fitness extraction accuracy: Claude extracted Week 13/Phase 2 but user is on Week 8. Extraction prompt needs to identify the *current active* week, not future phases. File: `src/lib/sync/fitness.ts`
- Add fitness sync cron job to cron-job.org (weekly trigger)

### P1 — New features
- **Delta briefing**: on-demand mid-day update showing what changed since 7:30 AM briefing (new emails, calendar changes, task updates). Compare current state vs morning baseline.
- **56-day Garmin retention**: keep 8 weeks of `garmin_daily` records instead of overwriting daily. Prune older than 56 days. On first run, backfill last 56 days from Garmin API.
- **Weekly/monthly health comparisons**: "avg sleep this week vs last week", "workout adherence this month vs last". Feed into briefing.

### P2 — Polish
- ElevenLabs voice tuning: Morgan stability 0.7-0.8 for tone consistency. Paul needs better training samples.
- Writing style refinement after real dual-script output
- Garmin Connect+ nutrition tracking investigation
- Domain sharpening (TBD)

### User context
- Filman is finishing Week 8 of transformation program. Week 9 starts Monday March 23, 2026.
- Currently Phase 1 (not Phase 2 as extracted). Fix extraction before next Monday.

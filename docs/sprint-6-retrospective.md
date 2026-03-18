# Sprint 6 Retrospective

**Date:** 2026-03-18
**Previous sprint:** Sprint 5 (Security Hardening + Jarvis Identity)

---

## What was delivered

### P0 — Voice & Briefing Overhaul

| Feature | Status |
|---------|--------|
| ElevenLabs TTS (replaces OpenAI) with dual voice toggle (Paul/Morgan) | Done |
| Streaming audio playback for reduced latency (non-iOS) | Done |
| Dual-script generation: written briefing + voiceover script | Done |
| Dual-script for email synthesis (same pattern) | Done |
| Writing style: dashboard-optimized written version, spoken-word voiceover | Done |

### P1 — Mobile Bug Fixes

| Feature | Status |
|---------|--------|
| TTSButton: force stop on Mobile Safari (src='', load()), AbortController | Done |
| VoiceMic: cancel during processing, no more frozen state | Done |
| Both buttons always tappable (no disabled during loading/processing) | Done |

### P2 — Dashboard Cleanup

| Feature | Status |
|---------|--------|
| Task blacklist filter for obsolete tasks | Done |
| Notion sync now deletes stale tasks from Supabase | Done |

### P3 — Transformation Program Intelligence

| Feature | Status |
|---------|--------|
| D1: Change detection — flags Notion program updates within 48h | Done |
| D2: Phase-aware — warns when phase transition <=2 weeks away | Done |
| D3: Planned vs actual — compares training_day_map with garmin_activities | Done |
| D4: Milestone tracker — current weight vs next target | Done |
| D5: Recovery alerts — low sleep/battery/readiness suggests lighter session | Done |
| D6: Biweekly check-in — Sunday prompt on even weeks | Done |

### Infrastructure

| Item | Status |
|------|--------|
| CLAUDE.md with Sprint DoD added to project | Done |
| Migration 009 (voiceover_text columns) | Done |
| ElevenLabs env vars configured (Railway + local) | Done |

---

## Stats

- 29 files changed, +2,721 lines
- 1 migration applied
- 3 new env vars (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_VOICE_ID_2)
- 0 TypeScript errors

---

## What went well

- All planned Sprint 6 items delivered in a single session
- ElevenLabs integration was clean — fallback to OpenAI works automatically
- Dual-script approach (written + voiceover) is a strong pattern that can extend to other content types
- Transformation intelligence features (D1-D6) are all conditional — they only fire when data exists, keeping the prompt lean on quiet days

## What didn't go well

- Sprint 6 handover doc from prior session was actually the Sprint 5 recap (mislabeled). Caused initial confusion about what was planned vs done.
- The sprint scope was discussed in a prior conversation but not persisted in code — the Notion Sprint logs page was the only source of truth for scope.

## Lessons learned

- Always write the sprint plan to `docs/` immediately, not just Notion — so the next session can pick up without re-discovery
- Sprint DoD is now enforced via CLAUDE.md — this discipline should prevent scope confusion in future sprints
- ElevenLabs Starter plan ($5/mo, 30k credits) may be tight for daily briefings. Monitor usage and upgrade to Creator if needed.

---

## Carry forward to Sprint 7

- Test ElevenLabs voice quality on production (Paul + Morgan) and tune voice_settings if needed
- Test mobile stop bug fix on actual iPhone
- Test streaming latency improvement on desktop
- Consider Garmin Connect+ nutrition tracking (deferred from Sprint 6)
- Writing style refinement — may need prompt tuning after seeing real dual-script output

## Post-sprint fix: branch unification

After sprint close, discovered Railway was deploying from `claude/recursing-borg` (Sprint 4 branch) instead of `main`. The two branches had diverged — 10 commits on recursing-borg not on main. Merged recursing-borg into main, resolved 7 conflicts, added v1.6 version label to TopBar, added branch discipline rules to CLAUDE.md. Railway now deploys from `main` only.

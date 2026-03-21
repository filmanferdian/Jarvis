# Sprint 11 Retrospective

**Version:** v2.1.2
**Date:** 2026-03-21
**Theme:** Current Events Synthesis + Prose Style Unification

## Delivery Summary

- **New feature:** Current events synthesis from newsletter emails
- **Style overhaul:** Email, news, and briefing synthesis prompts unified to natural prose
- **Bug fixes:** Garmin API rate limiting, integration health sync tracking
- **UI fix:** EmailCard left border and section header rendering removed

## What Was Built

### Current Events Synthesis (Sprint 11 headline feature)
- New synthesis type that extracts current events from newsletter emails
- Feeds into the morning briefing as a "world news" section
- Uses Claude API to distill newsletters into concise current affairs summaries

### Synthesis Prompt Style Unification
- All synthesis prompts (email, news, briefing) now produce natural flowing prose
- No markdown formatting (no `##` headers, no `**bold**`, no `*italic*`)
- No bullets, dashes, numbered lists, or emdashes
- Plain text section labels instead of markdown headers
- Warm, composed advisor tone with ~500 word limit
- EmailCard UI updated to match (removed left border, section header rendering)

### Garmin API Rate Limiting (carried from Sprint 10)
- Circuit breaker pattern to avoid hammering Garmin API
- Sequential fetch instead of parallel requests
- Daily request budget to stay within rate limits

### Integration Health Fixes (carried from Sprint 10)
- Added `markSynced` calls to email and briefing cron jobs
- Filtered internal integration types from health dashboard
- Aligned sync intervals across all integrations

### Briefing TTS Stability
- Reverted voiceover/TTS logic to original behavior after regression from style changes
- TTS continues to work with the new prose format

## What Went Well

1. **Prose style is a major UX improvement** — briefings and emails read naturally instead of feeling like bullet-point dumps
2. **Current events synthesis adds real daily value** — newsletters are now automatically distilled into the morning briefing
3. **Iterative prompt tuning** — multiple rounds of refinement got the tone right (no markdown leaking, no bullet lists)

## What Could Be Better

1. **No Sprint 10 retrospective written** — maintenance work (Garmin, integration health) was done without formal documentation
2. **PR workflow friction** — GitHub mobile app didn't support creating PRs; needed CLI workaround
3. **Style regression on TTS** — changing synthesis prompts briefly broke voiceover; needed a revert commit

## Decisions Made

1. Plain text only for all synthesis outputs — markdown adds no value in email or TTS contexts
2. Warm advisor tone over clinical/analytical — matches JARVIS brand personality
3. 500 word limit for synthesis — keeps briefings concise and TTS duration reasonable
4. Revert-then-fix approach for TTS regression — safer than trying to fix forward

# Changelog

All notable changes to Jarvis are documented here.

Format: `{major}.{sprint}.{iteration}` — major version, sprint number, iteration within sprint.

## [2.1.4] — 2026-03-21 (Sprint 12)

### Changed
- Synthesis writing style: all prompts (briefing, email, news) now use markdown with **bold** section labels, bullet points, and numbered lists
- News synthesis: stories cross-referenced across all emails with multi-source attribution (e.g. Bloomberg, NYT)
- News synthesis: narrowed sources to Bloomberg and NYT only, removed tier system
- News synthesis: removed voiceover section

### Added
- Shared `renderMarkdown` helper (`src/lib/renderMarkdown.ts`) for consistent markdown-to-HTML across all synthesis cards

### Fixed
- Markdown not rendering in EmailCard (was plain text), BriefingCard and NewsCard (partial regex only)
- Morning briefing cron timeout: TTS audio generation now runs in background (fire-and-forget) so response returns within 30s

## [1.7.0] — 2026-03-19 (Sprint 7)

### Added
- Health & Fitness OKR dashboard (`/health`) tracking 5 objectives from Notion
- Apple Health webhook expansion for body fat, waist, BP, lean body mass
- Blood work tracking with reference range indicators
- Utilities page (`/utilities`) with integration health and API cost tracking
- Per-service API usage tracking (Claude tokens, ElevenLabs chars, etc.)
- ElevenLabs → OpenAI TTS auto-failover on credit exhaustion
- 56-day data retention for Garmin daily, activities, weight, and health measurements
- Delta briefing (mid-day change summary)
- Fitness sync cron job
- Live WIB date/time display in TopBar
- Versioning system with prominent pill badge display
- Navigation between Dashboard, Health, and Utilities pages

### Fixed
- Fitness extraction accuracy (week 13 vs week 8 bug)
- Garmin cron 500 error

### Changed
- Voiceover persona refined to Alfred/British butler style
- Version format: `{major}.{sprint}.{iteration}`

## [1.6.0] — 2026-03-18 (Sprint 6)

### Added
- ElevenLabs TTS integration with dual voice toggle (Paul/Morgan)
- Streaming audio playback for reduced latency
- Dual-script generation (written briefing + voiceover script)
- 6 transformation intelligence features (change detection, phase-aware briefing, workout adherence, milestone tracker, recovery alerts, biweekly check-ins)
- Task blacklist filter and Notion stale task cleanup

### Fixed
- Voice cutoff after first sentence (collect all chunks before playing)
- Markdown rendering in briefing/email cards

## [1.5.0] — Sprint 5

### Added
- Garmin Connect integration (daily health metrics + activities)
- Weight tracking via Apple Health webhook
- Fitness context sync from Notion transformation program
- Health and Fitness domain KPIs auto-populated from Garmin

## [1.4.0] — Sprint 4

### Added
- Microsoft Outlook calendar and mail integration
- Email synthesis with Claude summarization
- Voice input with intent parsing

## [1.3.0] — Sprint 3

### Added
- Google Calendar and Gmail integration
- Morning briefing generation with Claude
- Notion tasks sync

## [1.2.0] — Sprint 2

### Added
- Dashboard UI with domain health indicators
- Sidebar with life domains and health ring
- KPI tracking system

## [1.1.0] — Sprint 1

### Added
- Initial project setup (Next.js + Supabase)
- Authentication system (cookie + cron secret)
- Core database schema

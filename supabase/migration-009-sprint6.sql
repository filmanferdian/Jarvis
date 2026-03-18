-- Sprint 6: Dual scripts — add voiceover columns for spoken-word delivery
-- Written text stays in existing columns; voiceover is optimized for TTS

ALTER TABLE briefing_cache ADD COLUMN IF NOT EXISTS voiceover_text TEXT;
ALTER TABLE email_synthesis ADD COLUMN IF NOT EXISTS voiceover_text TEXT;

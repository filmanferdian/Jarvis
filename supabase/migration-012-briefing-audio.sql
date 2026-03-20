-- Migration 012: Pre-generated briefing audio
-- Store TTS audio in Supabase Storage, reference URL in briefing_cache.
-- Previous day's audio is deleted on new generation to preserve storage.

-- Add audio_url column to briefing_cache
ALTER TABLE briefing_cache ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Create storage bucket for briefing audio (run via Supabase dashboard or API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('briefing-audio', 'briefing-audio', false);
-- Note: Bucket creation is handled programmatically in the app code using service role key.

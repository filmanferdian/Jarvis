-- Migration 025: Add Indonesia + International tabs to news_synthesis
-- v3.2.0 — Multi-source current events (Email / Indonesia / International)
-- Existing synthesis_text remains the Email tab (Bloomberg/NYT newsletter synth).
-- New columns hold Google News RSS-sourced syntheses for the two new tabs.

ALTER TABLE news_synthesis
  ADD COLUMN IF NOT EXISTS indonesia_synthesis TEXT,
  ADD COLUMN IF NOT EXISTS international_synthesis TEXT,
  ADD COLUMN IF NOT EXISTS indonesia_sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS international_sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS indonesia_article_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS international_article_count INTEGER DEFAULT 0;

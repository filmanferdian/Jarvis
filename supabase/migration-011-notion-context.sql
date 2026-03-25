-- Migration 011: Notion context cache for user profile pages
-- Stores synced content from Notion pages (About Me, Communication, Work, Growth, Projects)
-- Used by buildJarvisContext() to inject user context into all Claude API calls

CREATE TABLE IF NOT EXISTS notion_context (
  page_key TEXT PRIMARY KEY,
  notion_page_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  last_edited TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notion_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for notion_context" ON notion_context FOR ALL USING (true);

-- Migration 002: Replace ClickUp with Notion tasks
-- Run this if you already applied the initial migration.sql

-- Drop old ClickUp table
DROP TABLE IF EXISTS clickup_tasks;

-- Create Notion tasks cache
CREATE TABLE notion_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE,
  name TEXT NOT NULL,
  due_date DATE,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT CHECK (status IN ('Not Started', 'In Progress', 'Done', 'Archived')),
  project_name TEXT,
  tags TEXT[],
  last_synced TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notion_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON notion_tasks FOR ALL USING (true);

-- Add missing UNIQUE constraint on email_synthesis.date
-- (needed for ON CONFLICT upsert in n8n workflow)
ALTER TABLE email_synthesis ADD CONSTRAINT email_synthesis_date_unique UNIQUE (date);

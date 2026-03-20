-- Migration 013: Remove strict status check constraint on notion_tasks
-- Notion statuses can be customized by users, so we shouldn't restrict them.
-- The "For review" status was added in Notion but wasn't in the original constraint.

ALTER TABLE notion_tasks DROP CONSTRAINT IF EXISTS notion_tasks_status_check;

-- Migration 024: Enable RLS on email_draft_blocklist
-- Supabase security advisor flagged this as CRITICAL (rls_disabled_in_public).
-- App accesses this table only via SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS,
-- so no policy is needed — enabling RLS alone blocks anon/authenticated access.

ALTER TABLE email_draft_blocklist ENABLE ROW LEVEL SECURITY;

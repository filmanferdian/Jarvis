-- migration-027-drop-permissive-policies.sql
-- Drop all permissive `FOR ALL USING (true)` policies on public schema
-- tables. RLS stays enabled — with no policy, only the service-role key
-- (used server-side by the app) can access these tables.
--
-- Rationale: anon/publishable key holders previously had full read+write
-- on sensitive tables (google_tokens, microsoft_tokens, garmin_tokens,
-- weight_log, health_measurements, blood_work, okr_targets, etc.). Same
-- pattern as cron_run_log and email_draft_blocklist.

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.api_usage;
DROP POLICY IF EXISTS "api_usage_v2_all" ON public.api_usage_v2;
DROP POLICY IF EXISTS "blood_work_all" ON public.blood_work;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.briefing_cache;
DROP POLICY IF EXISTS "Allow all for service role" ON public.briefing_deltas;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.domain_kpis;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.domains;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.email_synthesis;
DROP POLICY IF EXISTS "Allow all for service role" ON public.email_triage;
DROP POLICY IF EXISTS "Allow all" ON public.fitness_context;
DROP POLICY IF EXISTS "Allow all" ON public.garmin_activities;
DROP POLICY IF EXISTS "Allow all" ON public.garmin_daily;
DROP POLICY IF EXISTS "service role full access" ON public.garmin_tokens;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.google_tokens;
DROP POLICY IF EXISTS "health_measurements_all" ON public.health_measurements;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.microsoft_tokens;
DROP POLICY IF EXISTS "Allow all for service role" ON public.news_synthesis;
DROP POLICY IF EXISTS "Allow all for service role" ON public.notion_context;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.notion_tasks;
DROP POLICY IF EXISTS "okr_targets_all" ON public.okr_targets;
DROP POLICY IF EXISTS "Allow all for service role" ON public.program_schedule;
DROP POLICY IF EXISTS "Allow all for service role" ON public.scanned_contacts;
DROP POLICY IF EXISTS "service role full access" ON public.sync_account_status;
DROP POLICY IF EXISTS "Allow all for service role" ON public.sync_status;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.top_kpis;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.voice_log;
DROP POLICY IF EXISTS "Allow all" ON public.weight_log;

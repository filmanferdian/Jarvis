-- Migration 029: Career job watch
-- Twice-weekly (Tue/Thu) automated check of open roles at Anthropic, Stripe,
-- Revolut. Surfaces in-region roles scored against Filman's profile.
-- One row per (company, external_id). RLS enabled, no permissive policy:
-- only the server-side service-role key can read/write (matches migration-027).

CREATE TABLE IF NOT EXISTS career_job_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  department text,
  location text,
  url text NOT NULL,
  description_raw text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'new',        -- new | reviewing | applied | passed
  fit_verdict text,                           -- fit | partial | not_fit
  fit_score int,                              -- 0-100
  role_summary text,
  fit_rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company, external_id)
);

CREATE INDEX IF NOT EXISTS idx_career_job_watch_company ON career_job_watch (company);
CREATE INDEX IF NOT EXISTS idx_career_job_watch_status ON career_job_watch (status);

ALTER TABLE career_job_watch ENABLE ROW LEVEL SECURITY;

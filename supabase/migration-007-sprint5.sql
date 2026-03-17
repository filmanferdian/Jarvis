-- Sprint 5: Cron run logging for monitoring
CREATE TABLE IF NOT EXISTS cron_run_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  message TEXT,
  duration_ms INTEGER,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by job name and time
CREATE INDEX IF NOT EXISTS idx_cron_run_log_job_ran
  ON cron_run_log (job_name, ran_at DESC);

-- Enable RLS
ALTER TABLE cron_run_log ENABLE ROW LEVEL SECURITY;

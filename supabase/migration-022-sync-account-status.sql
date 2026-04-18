-- Per-account sync health tracking. Sits alongside sync_status (which stays
-- job-scoped) and stores one row per (sync_type, account). Populated by
-- markAccountSynced() from each multi-account sync module so the utilities
-- dashboard can surface individual account failures instead of only aggregate
-- job status.

CREATE TABLE IF NOT EXISTS sync_account_status (
  sync_type       TEXT NOT NULL,
  account_key     TEXT NOT NULL,           -- "google:email" or "outlook:email"
  last_synced_at  TIMESTAMPTZ,
  last_result     TEXT,                    -- 'success' | 'error'
  last_error      TEXT,
  events_synced   INTEGER,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sync_type, account_key)
);

CREATE INDEX IF NOT EXISTS sync_account_status_sync_type_idx
  ON sync_account_status (sync_type);

ALTER TABLE sync_account_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sync_account_status'
  ) THEN
    CREATE POLICY "service role full access" ON sync_account_status FOR ALL USING (true);
  END IF;
END $$;

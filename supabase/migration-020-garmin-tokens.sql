-- Move Garmin OAuth tokens out of sync_status.last_error (H3) into a dedicated
-- table. Values are AES-256-GCM encrypted at the application layer via src/lib/crypto.ts
-- (enc:v1:<iv>:<tag>:<ciphertext>), so these columns always hold ciphertext text,
-- never raw JSON.

CREATE TABLE IF NOT EXISTS garmin_tokens (
  id TEXT PRIMARY KEY DEFAULT 'default',
  tokens_encrypted TEXT NOT NULL,   -- AES-GCM(JSON.stringify({ oauth1, oauth2 }))
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE garmin_tokens ENABLE ROW LEVEL SECURITY;

-- Single-user app: service_role bypasses RLS; this policy is defense-in-depth only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'garmin_tokens'
  ) THEN
    CREATE POLICY "service role full access" ON garmin_tokens FOR ALL USING (true);
  END IF;
END
$$;

-- After deployment, run this once to clear the old plaintext token blob from
-- sync_status.last_error. The app writes to garmin_tokens on the next successful sync.
-- UPDATE sync_status SET last_error = NULL WHERE sync_type = 'garmin-tokens';

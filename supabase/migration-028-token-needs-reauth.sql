-- Adds needs_reauth flag to OAuth token tables so the integrations dashboard
-- can surface a Reconnect CTA when a refresh_token is revoked/expired
-- (Google/Microsoft return 400 invalid_grant on refresh in that case).

ALTER TABLE google_tokens
  ADD COLUMN IF NOT EXISTS needs_reauth boolean NOT NULL DEFAULT false;

ALTER TABLE microsoft_tokens
  ADD COLUMN IF NOT EXISTS needs_reauth boolean NOT NULL DEFAULT false;

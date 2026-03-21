#!/usr/bin/env node
/**
 * Garmin Token Seeder
 *
 * Run this locally (on your laptop with residential IP, NOT on Railway)
 * to login to Garmin, extract OAuth tokens, and push them to Supabase.
 *
 * Usage:
 *   GARMIN_EMAIL=xxx GARMIN_PASSWORD=xxx SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/seed-garmin-tokens.mjs
 *
 * Or with .env.local:
 *   node --env-file=.env.local scripts/seed-garmin-tokens.mjs
 */

import { GarminConnect } from 'garmin-connect';
import { createClient } from '@supabase/supabase-js';

const email = process.env.GARMIN_EMAIL;
const password = process.env.GARMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!email || !password) {
  console.error('Missing GARMIN_EMAIL or GARMIN_PASSWORD');
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log(`Logging in as ${email} from your local IP...`);

  const client = new GarminConnect({ username: email, password });
  await client.login();
  console.log('Login successful!');

  // Export OAuth tokens
  const tokens = client.exportToken();
  console.log('OAuth1 token:', tokens.oauth1.oauth_token ? 'present' : 'MISSING');
  console.log('OAuth2 token:', tokens.oauth2 ? 'present' : 'MISSING');

  // Verify tokens work with a lightweight call
  const profile = await client.getUserProfile();
  console.log(`Verified: logged in as ${profile.displayName || profile.userName || 'unknown'}`);

  // Push tokens to Supabase
  const { error } = await supabase.from('sync_status').upsert(
    {
      sync_type: 'garmin-tokens',
      last_synced_at: new Date().toISOString(),
      last_result: 'success',
      last_error: JSON.stringify(tokens),
    },
    { onConflict: 'sync_type' },
  );

  if (error) {
    console.error('Failed to save tokens to Supabase:', error);
    process.exit(1);
  }

  // Also clear the circuit breaker so the next cron run tries immediately
  await supabase.from('sync_status').upsert(
    {
      sync_type: 'garmin-circuit-breaker',
      last_synced_at: new Date().toISOString(),
      last_result: 'clear',
      last_error: JSON.stringify({ failure_count: 0 }),
    },
    { onConflict: 'sync_type' },
  );

  console.log('\nTokens saved to Supabase and circuit breaker cleared.');
  console.log('The next cron run will use these cached tokens (no login needed).');
  console.log('OAuth1 tokens last ~1 year. OAuth2 auto-refreshes via connectapi.garmin.com.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});

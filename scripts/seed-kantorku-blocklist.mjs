#!/usr/bin/env node
/**
 * Seed Kantorku Blocklist
 *
 * Scans email_triage rows from the last 7 days for Kantorku senders
 * (especially rows where a draft was created — those are the wasted drafts
 * the blocklist is designed to prevent), reports findings, and inserts
 * 'kantorku' as the initial blocklist pattern.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-kantorku-blocklist.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const { data: audit, error: auditErr } = await supabase
  .from('email_triage')
  .select('from_address, from_name, subject, category, draft_created, received_at')
  .ilike('from_address', '%kantorku%')
  .gte('received_at', sevenDaysAgo)
  .order('received_at', { ascending: false });

if (auditErr) {
  console.error('Audit query failed:', auditErr.message);
  process.exit(1);
}

console.log(`Found ${audit?.length ?? 0} Kantorku-related emails in the last 7 days:`);
for (const row of audit || []) {
  const draftTag = row.draft_created ? '[DRAFTED]' : '         ';
  console.log(`  ${draftTag} ${row.received_at}  ${row.category}  ${row.from_address}  — ${row.subject}`);
}
const drafted = (audit || []).filter((r) => r.draft_created).length;
console.log(`\n${drafted} of those had drafts auto-created (wasted Claude tokens).`);

const { data: inserted, error: insertErr } = await supabase
  .from('email_draft_blocklist')
  .upsert(
    { pattern: 'kantorku', reason: 'HRIS action-button emails — requires in-email action, not a reply' },
    { onConflict: 'pattern' },
  )
  .select()
  .single();

if (insertErr) {
  console.error('Insert failed:', insertErr.message);
  process.exit(1);
}

console.log(`\nBlocklist entry ready: pattern="${inserted.pattern}" reason="${inserted.reason}"`);

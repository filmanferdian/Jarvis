// One-shot verification for garmin_activity_details (Charge/FP rich run data).
// Fetches a few recent activities, picks the latest outdoor run + latest treadmill run,
// runs buildAndUpsertActivityDetails on each, then reads the rows back and prints a summary.
// Usage: npx tsx scripts/test-activity-details.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(p: string) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.resolve(process.cwd(), '.env.local'));          // worktree (may be absent)
loadEnv(path.resolve(process.cwd(), '../../../.env.local')); // repo root

async function main() {
  const { createGarminClient } = await import('../src/lib/sync/garmin');
  const { buildAndUpsertActivityDetails } = await import('../src/lib/sync/activityDetails');

  const client = await createGarminClient();
  const acts = (await client.getActivities(0, 15)) as unknown as Record<string, unknown>[];
  const runs = acts.filter((a) =>
    String((a.activityType as Record<string, unknown>)?.typeKey ?? '').includes('run'),
  );
  const outdoor = runs.find((a) => (a.activityType as Record<string, unknown>)?.typeKey === 'running');
  const treadmill = runs.find((a) => (a.activityType as Record<string, unknown>)?.typeKey === 'treadmill_running');

  // Optional: pass an activity_id to enrich just that one (keeps Garmin calls low).
  const onlyId = process.argv[2];
  const picks = (onlyId
    ? runs.filter((a) => String(a.activityId) === onlyId)
    : [outdoor, treadmill].filter(Boolean)) as Record<string, unknown>[];
  console.log('Picked:', picks.map((a) => `${a.activityId}(${(a.activityType as Record<string, unknown>)?.typeKey}, dist=${a.distance})`).join(', '));

  for (const act of picks) {
    await buildAndUpsertActivityDetails(client, act);
    console.log('Upserted', act.activityId);
    await new Promise((r) => setTimeout(r, 1500));
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb
    .from('garmin_activity_details')
    .select('*')
    .in('activity_id', picks.map((a) => String(a.activityId)));

  for (const row of data ?? []) {
    const splits = (row.splits ?? []) as Record<string, unknown>[];
    const hr = (row.hr_samples ?? []) as number[];
    console.log('\n=== activity', row.activity_id, '===');
    console.log('total_distance_m', row.total_distance_m, 'avg_cadence', row.avg_cadence, 'max_hr', row.max_hr, 'elev', row.elevation_gain_m);
    console.log('hr_zone_seconds', JSON.stringify(row.hr_zone_seconds));
    console.log('hr_samples: len', hr.length, 'min', hr.length ? Math.min(...hr) : null, 'max', hr.length ? Math.max(...hr) : null);
    console.log('splits: n', splits.length, 'sum_dist', splits.reduce((s, x) => s + (x.distance_m as number), 0));
    for (const s of splits) console.log('  ', JSON.stringify(s));
  }
}

main()
  .then(() => { setTimeout(() => process.exit(0), 300); })
  .catch((e) => { console.error(e); setTimeout(() => process.exit(1), 300); });

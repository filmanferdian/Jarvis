// One-shot read-only inspection of a Garmin activity's decrypted raw_json.
// Usage: npx tsx scripts/inspect-activity.ts <activityId>
//   e.g. npx tsx scripts/inspect-activity.ts 22814566651
import { createClient } from '@supabase/supabase-js';
import { unwrapJsonb } from '../src/lib/crypto';
import * as fs from 'fs';
import * as path from 'path';

// Minimal .env loader (avoid dotenv dep). Try worktree, then repo root.
function loadEnv(p: string) {
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.resolve(__dirname, '../.env.local'));
loadEnv(path.resolve(__dirname, '../../../../.env.local'));

const activityId = process.argv[2];
if (!activityId) {
  console.error('Usage: npx tsx scripts/inspect-activity.ts <activityId>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase
    .from('garmin_activities')
    .select('activity_id, started_at, distance_meters, duration_seconds, avg_pace, avg_hr, raw_json')
    .eq('activity_id', activityId)
    .single();

  if (error || !data) {
    console.error('Fetch error:', error);
    process.exit(1);
  }

  const raw = unwrapJsonb<Record<string, unknown>>(data.raw_json);
  if (!raw) {
    console.error('Failed to decrypt raw_json');
    process.exit(1);
  }

  console.log('=== Activity ===');
  console.log('id:', data.activity_id);
  console.log('started:', data.started_at);
  console.log('name:', raw.activityName);
  console.log('distance(m):', data.distance_meters, '  duration(s):', data.duration_seconds);
  console.log('avg_pace:', data.avg_pace, '  avg_hr:', data.avg_hr);
  console.log('');
  console.log('=== Cadence-related fields ===');
  const steps = raw.steps as number | null;
  const movingDuration = raw.movingDuration as number | null;
  const duration = raw.duration as number | null;
  const garminAvgCadence = raw.averageRunningCadenceInStepsPerMinute as number | null;
  console.log('steps:', steps);
  console.log('movingDuration(s):', movingDuration);
  console.log('duration(s):', duration);
  console.log('Garmin reported averageRunningCadenceInStepsPerMinute:', garminAvgCadence);
  if (steps && movingDuration) {
    console.log('Computed steps/(movingDuration/60):', (steps / (movingDuration / 60)).toFixed(1));
  }
  if (steps && duration) {
    console.log('Computed steps/(duration/60):', (steps / (duration / 60)).toFixed(1));
  }
  console.log('');

  // Try to find lap data — could be on raw, or fetched separately. Check several keys.
  const possibleLapKeys = ['lapDTOs', 'splits', 'laps', 'splitSummaries'];
  for (const k of possibleLapKeys) {
    if (raw[k]) {
      console.log(`Found '${k}' on raw_json (length: ${(raw[k] as unknown[]).length})`);
    }
  }

  // Print all top-level keys for reference
  console.log('');
  console.log('=== All raw_json top-level keys ===');
  console.log(Object.keys(raw).sort().join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

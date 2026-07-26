// Backfill garmin_activity_details for runs whose per-lap data is missing (Notion exit gate).
//
// Primary source is the Garmin API, via syncActivityDetailsFor, so backfilled rows are shape-
// identical to what the live sync writes (lap_detail + splits + hr_samples + scalars).
// Fallback is the Notion Runs DB `Lap Profile` property, which is lossier: it has no per-lap
// max HR / GCT / power / vertical ratio, older rows have no cadence, and its lap distances are
// frequently not 1 km, so `splits` CANNOT be reconstructed from it and is left untouched.
//
// Targeting predicate is `lap_detail IS NULL`, not row-absence, so it also repairs rows that
// exist with null laps (partial fetches, the out-of-band scalar backfill). The live sync keys
// off row existence and can never repair those.
//
// Idempotent and resumable: a completed activity gains lap_detail and drops out of the next run.
//
// Garmin allows ~50 calls/day and each activity costs 3, so this is a multi-day operation.
// Default --limit=8 matches the per-run cap in syncActivityDetailsFor.
//
// Usage:
//   npx tsx scripts/backfill-run-details.ts                       # dry run, no writes, no API calls
//   npx tsx scripts/backfill-run-details.ts --apply
//   npx tsx scripts/backfill-run-details.ts --apply --limit=8
//   npx tsx scripts/backfill-run-details.ts --apply --from=2026-04-01 --to=2026-06-30
//   npx tsx scripts/backfill-run-details.ts --apply --id=23672188748
//   npx tsx scripts/backfill-run-details.ts --apply --notion-only  # skip Garmin entirely
//   npx tsx scripts/backfill-run-details.ts --apply --ceiling=40   # raise the daily-usage guard
//   npx tsx scripts/backfill-run-details.ts --apply --force --id=X # re-enrich a row that already
//                                                                 # has laps (upgrade a Notion
//                                                                 # fallback row to full fidelity)
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

// Notion Runs DB — inlined because src/lib/running-analysis/notion-runs-db.ts is deleted by the
// cutover and this script is the last thing that reads Notion for runs.
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const RUNS_DB_ID = '061105bb-bd86-464b-b344-c86d89c771ca';

const WIB = '+07:00';
const DEFAULT_FROM = '2026-04-01';
const DEFAULT_LIMIT = 8;
/** Abort the day's run if Garmin has already been hit this hard. Leaves headroom for the cron. */
const GARMIN_CALL_CEILING = 30;

interface Args {
  apply: boolean; limit: number; from: string; to: string;
  id: string | null; notionOnly: boolean; ceiling: number; force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  const todayWib = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
  return {
    apply: argv.includes('--apply'),
    limit: Number(get('limit') ?? DEFAULT_LIMIT),
    from: get('from') ?? DEFAULT_FROM,
    to: get('to') ?? todayWib,
    id: get('id'),
    notionOnly: argv.includes('--notion-only'),
    ceiling: Number(get('ceiling') ?? GARMIN_CALL_CEILING),
    force: argv.includes('--force'),
  };
}

interface Candidate {
  activity_id: string;
  started_at: string;
  activity_type: string;
  distance_meters: number | null;
  duration_seconds: number | null;
  avg_hr: number | null;
  hasRow: boolean;
}

/** Same run/walk heuristic the weekly analysis uses, so Garmin budget isn't spent on incline walks. */
function isRealRun(c: Candidate): boolean {
  if (!c.duration_seconds || !c.distance_meters) return true;
  const secPerKm = (c.duration_seconds / c.distance_meters) * 1000;
  if (secPerKm <= 600) return true;
  if (c.avg_hr != null && c.avg_hr >= 130) return true;
  return false;
}

async function findCandidates(sb: SupabaseClient, args: Args): Promise<Candidate[]> {
  let q = sb
    .from('garmin_activities')
    .select('activity_id, started_at, activity_type, distance_meters, duration_seconds, avg_hr')
    .ilike('activity_type', '%run%')
    .order('started_at', { ascending: true });

  if (args.id) {
    q = q.eq('activity_id', args.id);
  } else {
    q = q.gte('started_at', `${args.from}T00:00:00${WIB}`).lte('started_at', `${args.to}T23:59:59${WIB}`);
  }

  const { data: acts, error } = await q;
  if (error) throw new Error(`garmin_activities query failed: ${error.message}`);
  if (!acts?.length) return [];

  const ids = acts.map((a) => a.activity_id);
  const { data: details } = await sb
    .from('garmin_activity_details')
    .select('activity_id, lap_detail')
    .in('activity_id', ids);

  const rowById = new Map((details ?? []).map((d) => [d.activity_id, d]));

  return acts
    .map((a) => ({ ...a, hasRow: rowById.has(a.activity_id) } as Candidate))
    // Missing row OR null laps. --force also re-visits rows that already have laps, which is how
    // a row filled by the lossy Notion fallback gets upgraded to full Garmin fidelity later.
    .filter((c) => args.force || rowById.get(c.activity_id)?.lap_detail == null)
    .filter(isRealRun);
}

// --- Notion fallback ---

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

interface NotionRunFields { lapProfile: string | null; sessionProfile: string | null }

async function fetchNotionRun(apiKey: string, garminId: string): Promise<NotionRunFields | null> {
  const res = await fetch(`${NOTION_API}/databases/${RUNS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      filter: { property: 'Garmin ID', rich_text: { equals: garminId } },
      page_size: 1,
    }),
  });
  if (!res.ok) throw new Error(`Notion query ${garminId}: ${res.status}`);
  const data = await res.json();
  const page = data.results?.[0];
  if (!page) return null;

  const props = page.properties as Record<string, unknown>;
  const text = (key: string) =>
    ((props[key] as { rich_text?: { plain_text: string }[] })?.rich_text?.[0]?.plain_text) ?? null;

  return { lapProfile: text('Lap Profile'), sessionProfile: text('Session Profile') };
}

/**
 * Notion's compact laps -> the shape the live sync writes. All twelve keys are present, with the
 * fields Notion never carried set explicitly to null so consumers see a uniform object.
 */
function toLapDetail(laps: { i: number; t: string; d: number; du: number; hr: number | null; p: number | null; c: number | null }[]) {
  return laps.map((l) => ({
    index: l.i,
    segment: l.t,
    distance_m: l.d,
    duration_s: l.du,
    pace_sec_per_km: l.p ?? null,
    avg_hr: l.hr ?? null,
    max_hr: null,
    cadence: l.c ?? null,
    gct_ms: null,
    vertical_ratio: null,
    elev_gain_m: null,
    power_w: null,
  }));
}

async function main() {
  const args = parseArgs();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const candidates = await findCandidates(sb, args);

  console.log(`\nWindow ${args.id ? `id=${args.id}` : `${args.from} .. ${args.to}`}`);
  console.log(`${candidates.length} run(s) with no lap_detail:\n`);
  for (const c of candidates) {
    console.log(`  ${c.activity_id}  ${c.started_at.slice(0, 10)}  ${c.activity_type.padEnd(18)} ${c.hasRow ? 'row exists, laps null' : 'no row'}`);
  }

  if (!args.apply) {
    console.log(`\nDry run. Would process up to ${args.limit}. Re-run with --apply.\n`);
    return;
  }
  if (candidates.length === 0) {
    console.log('\nNothing to do.\n');
    return;
  }

  const targets = candidates.slice(0, args.limit);
  console.log(`\nProcessing ${targets.length} of ${candidates.length}.\n`);

  const done = new Set<string>();
  let garminWritten = 0;
  let notionWritten = 0;
  const failures: string[] = [];

  // --- Pass 1: Garmin ---
  if (!args.notionOnly) {
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: usage } = await sb
      .from('api_usage_v2')
      .select('call_count')
      .eq('date', today)
      .eq('service', 'garmin')
      .maybeSingle();
    const used = usage?.call_count ?? 0;
    if (used >= args.ceiling) {
      console.log(`Garmin already at ${used} calls today (ceiling ${args.ceiling}, raise with --ceiling=N). Skipping Garmin pass.\n`);
    } else {
      const { syncActivityDetailsFor } = await import('../src/lib/sync/garmin');
      console.log(`Garmin pass (${used} calls used today)…`);
      const res = await syncActivityDetailsFor(targets.map((t) => t.activity_id), { max: args.limit, force: args.force });
      console.log(`  attempted=${res.attempted} written=${res.written} skipped=${res.skipped} blocked=${res.blocked}`);
      for (const e of res.errors) console.log(`  ! ${e}`);
      garminWritten = res.written;

      // Confirm which ones actually came out with laps — a partial fetch can write scalars only.
      const { data: after } = await sb
        .from('garmin_activity_details')
        .select('activity_id, lap_detail')
        .in('activity_id', targets.map((t) => t.activity_id));
      for (const r of after ?? []) if (r.lap_detail != null) done.add(r.activity_id);
    }
  }

  // --- Pass 2: Notion fallback for whatever Garmin didn't land ---
  const remaining = targets.filter((t) => !done.has(t.activity_id));
  if (remaining.length > 0) {
    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) {
      console.log(`\n${remaining.length} still without laps and NOTION_API_KEY is unset — cannot fall back.`);
      remaining.forEach((r) => failures.push(`${r.activity_id}: no laps, no Notion fallback available`));
    } else {
      const { parseLapsFromProperty } = await import('../src/lib/running-analysis/garmin-enrich');
      console.log(`\nNotion fallback for ${remaining.length}…`);

      for (const c of remaining) {
        try {
          const fields = await fetchNotionRun(apiKey, c.activity_id);
          if (!fields) { failures.push(`${c.activity_id}: no Notion counterpart`); continue; }

          const laps = parseLapsFromProperty(fields.lapProfile);
          if (laps.length === 0) { failures.push(`${c.activity_id}: Notion row has no Lap Profile`); continue; }

          const patch: Record<string, unknown> = {
            activity_id: c.activity_id,
            lap_detail: toLapDetail(laps),
            session_profile: fields.sessionProfile,
            updated_at: new Date().toISOString(),
          };
          // NOTE: splits and hr_samples are deliberately absent. Notion lap distances are not
          // per-km, so a derived splits array would corrupt the Charge app's contract.
          const { error } = await sb
            .from('garmin_activity_details')
            .upsert(patch, { onConflict: 'activity_id' });
          if (error) { failures.push(`${c.activity_id}: upsert failed ${error.message}`); continue; }

          notionWritten++;
          done.add(c.activity_id);
          console.log(`  ${c.activity_id}  notion  laps=${laps.length}  profile=${JSON.stringify(fields.sessionProfile)}`);
        } catch (err) {
          failures.push(`${c.activity_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        await new Promise((r) => setTimeout(r, 400)); // Notion allows ~3 req/s
      }
    }
  }

  console.log(`\n--- summary ---`);
  console.log(`garmin: ${garminWritten}   notion: ${notionWritten}   failed: ${failures.length}`);
  console.log(`remaining in window after this run: ${candidates.length - done.size}`);
  for (const f of failures) console.log(`  ! ${f}`);
  console.log('');

  if (failures.length > 0) process.exitCode = 1;
}

main()
  .then(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 300); })
  .catch((e) => { console.error(e instanceof Error ? e.message : e); setTimeout(() => process.exit(1), 300); });

#!/usr/bin/env node
/**
 * Archive treadmill-walk run pages from the Notion Runs DB.
 *
 * Mirrors the v3.4.0 ingest filter (drop activities with pace > 10:00/km)
 * for rows that landed in Notion before that filter was added.
 *
 * Usage:
 *   node --env-file=.env.local scripts/archive-walk-runs.mjs            # dry run, default date
 *   node --env-file=.env.local scripts/archive-walk-runs.mjs --apply    # actually archive
 *   node --env-file=.env.local scripts/archive-walk-runs.mjs --date=2026-04-22
 *   node --env-file=.env.local scripts/archive-walk-runs.mjs --from=2026-04-20 --to=2026-04-22
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const RUNS_DB_ID = '061105bb-bd86-464b-b344-c86d89c771ca';
const PACE_THRESHOLD_SEC_PER_KM = 600; // 10:00/km

const apiKey = process.env.NOTION_API_KEY;
if (!apiKey) {
  console.error('Missing NOTION_API_KEY (load .env.local with --env-file)');
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dateArg = args.find((a) => a.startsWith('--date='))?.slice(7);
const fromArg = args.find((a) => a.startsWith('--from='))?.slice(7);
const toArg = args.find((a) => a.startsWith('--to='))?.slice(5);
const startDate = fromArg ?? dateArg ?? '2026-04-22';
const endDate = toArg ?? dateArg ?? '2026-04-22';

const headers = {
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'Notion-Version': NOTION_VERSION,
};

function parseDurationToSec(str) {
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function plain(prop) {
  if (!prop) return null;
  if (prop.title?.length) return prop.title.map((t) => t.plain_text).join('');
  if (prop.rich_text?.length) return prop.rich_text.map((t) => t.plain_text).join('');
  return null;
}

async function queryRuns() {
  const pages = [];
  let cursor;
  while (true) {
    const body = {
      page_size: 100,
      filter: {
        and: [
          { property: 'Date', date: { on_or_after: startDate } },
          { property: 'Date', date: { on_or_before: endDate } },
        ],
      },
      sorts: [{ property: 'Date', direction: 'ascending' }],
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${NOTION_API}/databases/${RUNS_DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Query failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const data = await res.json();
    pages.push(...(data.results ?? []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return pages;
}

async function archivePage(pageId) {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ archived: true }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

(async () => {
  console.log(`[archive-walk-runs] Querying Notion Runs DB for ${startDate} → ${endDate}`);
  const pages = await queryRuns();
  console.log(`[archive-walk-runs] Found ${pages.length} page(s) in date range\n`);

  const candidates = [];
  for (const p of pages) {
    const props = p.properties ?? {};
    const name = plain(props['Run']) ?? '(unnamed)';
    const date = props['Date']?.date?.start ?? '?';
    const distanceKm = props['Distance (km)']?.number ?? null;
    const durationStr = plain(props['Duration']);
    const durationSec = parseDurationToSec(durationStr);
    const pacePerKmStr = plain(props['Avg Pace']);
    const garminId = plain(props['Garmin ID']);

    let secPerKm = null;
    if (distanceKm && durationSec) {
      secPerKm = durationSec / distanceKm;
    } else if (pacePerKmStr) {
      secPerKm = parseDurationToSec(pacePerKmStr);
    }

    const paceMin = secPerKm != null ? Math.floor(secPerKm / 60) : null;
    const paceSec = secPerKm != null ? Math.round(secPerKm % 60) : null;
    const paceFmt = secPerKm != null ? `${paceMin}:${String(paceSec).padStart(2, '0')}/km` : '—';
    const isWalk = secPerKm != null && secPerKm > PACE_THRESHOLD_SEC_PER_KM;

    console.log(
      `  ${date}  ${name.padEnd(40)}  ${distanceKm ?? '—'} km  ${durationStr ?? '—'}  pace ${paceFmt}  garmin=${garminId ?? '—'}  ${isWalk ? '← WALK' : ''}`,
    );
    if (isWalk) candidates.push({ id: p.id, name, date, paceFmt });
  }

  console.log(`\n[archive-walk-runs] ${candidates.length} candidate(s) (pace > 10:00/km)`);

  if (candidates.length === 0) {
    console.log('Nothing to archive.');
    return;
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to archive these pages.');
    return;
  }

  for (const c of candidates) {
    process.stdout.write(`Archiving ${c.date} ${c.name} (${c.paceFmt}) … `);
    try {
      await archivePage(c.id);
      console.log('ok');
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  console.log(`\n[archive-walk-runs] Archived ${candidates.length} page(s).`);
  console.log('Next: trigger /api/running-analysis with weekStart=2026-04-20 to regenerate the weekly insight.');
})();

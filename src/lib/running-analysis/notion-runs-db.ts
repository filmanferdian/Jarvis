/**
 * Notion Runs Database read/write module.
 * Handles redundancy check (by Garmin ID) and page creation.
 */

import type { SegmentType } from './garmin-enrich';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const RUNS_DB_ID = '061105bb-bd86-464b-b344-c86d89c771ca';

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

export interface RunActivity {
  garminId: string;
  name: string;
  date: string; // YYYY-MM-DD
  distanceKm: number;
  durationFormatted: string; // HH:MM:SS or MM:SS
  avgPacePerKm: string; // M:SS
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  cadenceSpm: number | null;
  strideCm: number | null;
  gctMs: number | null;
  vertOscCm: number | null;
  vertRatioPct: number | null;
  avgPowerW: number | null;
  trainingLoad: number | null;
  trainingEffect: string | null;
  vo2Max: number | null;
  elevGainM: number | null;
  fastestKmPace: string | null;
  location: string | null;
  tempC: number | null;
  feelsLikeC: number | null;
  humidityPct: number | null;
  weather: string | null;
  perfCondition: number | null;
  decouplingPct: number | null;
  // HR zones (time in seconds)
  hrZ1s: number | null;
  hrZ2s: number | null;
  hrZ3s: number | null;
  hrZ4s: number | null;
  hrZ5s: number | null;
  // Splits for page content
  splits: {
    lapIndex: number;
    distanceMeters: number;
    durationSeconds: number;
    pacePerKm: string;
    avgHr: number | null;
    maxHr: number | null;
    cadence: number | null;
    strideCm: number | null;
    gctMs: number | null;
    powerW: number | null;
    vertOscCm: number | null;
    vertRatioPct: number | null;
    elevGain: number | null;
    elevLoss: number | null;
    segmentType: SegmentType;
  }[];
}

function segmentLabel(type: SegmentType, intervalCounter: number | null): string | null {
  switch (type) {
    case 'warm-up': return 'warm-up';
    case 'cool-down': return 'cool-down';
    case 'tempo': return 'tempo';
    case 'interval-rest': return 'rest';
    case 'interval-work': return intervalCounter != null ? `int ${intervalCounter}` : 'int';
    case 'main':
    default: return null;
  }
}

function formatLapCell(
  split: { lapIndex: number; distanceMeters: number; segmentType: SegmentType },
  intervalCounter: number | null,
): string {
  const km = (split.distanceMeters / 1000).toFixed(2);
  const label = segmentLabel(split.segmentType, intervalCounter);
  const base = `L${split.lapIndex} · ${km} km`;
  return label ? `${base} (${label})` : base;
}

/** Check which Garmin IDs already exist in the Runs DB */
export async function getExistingGarminIds(apiKey: string): Promise<Set<string>> {
  const existing = new Set<string>();
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: { property: 'Garmin ID', rich_text: { is_not_empty: true } },
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${NOTION_API}/databases/${RUNS_DB_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = await res.json();

    for (const page of data.results ?? []) {
      const gidProp = page.properties?.['Garmin ID'];
      const gid = gidProp?.rich_text?.[0]?.plain_text;
      if (gid) existing.add(gid);
    }

    hasMore = data.has_more ?? false;
    cursor = data.next_cursor ?? undefined;
  }

  return existing;
}

function secondsToTimeStr(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function hrZoneStr(seconds: number | null): string {
  if (!seconds) return '0:00';
  return secondsToTimeStr(seconds);
}

function buildPageContent(run: RunActivity): object[] {
  const blocks: object[] = [];

  // Lap Splits table
  if (run.splits.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Lap Splits' } }],
      },
    });

    // Table header — 11 columns
    const cell = (content: string) => [{ type: 'text', text: { content } }];
    const tableRows: object[] = [
      {
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            cell('Lap'), cell('Pace'), cell('Avg HR'), cell('Max HR'),
            cell('Cadence'), cell('Stride (cm)'), cell('GCT (ms)'),
            cell('Power (W)'), cell('Vert Osc (cm)'), cell('Vert Ratio'),
            cell('Elev +/- (m)'),
          ],
        },
      },
    ];

    let intervalSeq = 0;
    for (const split of run.splits) {
      const intervalCounter = split.segmentType === 'interval-work' ? ++intervalSeq : null;
      const elevStr = (split.elevGain != null || split.elevLoss != null)
        ? `+${Math.round(split.elevGain ?? 0)} / -${Math.round(split.elevLoss ?? 0)}`
        : '—';
      tableRows.push({
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            cell(formatLapCell(split, intervalCounter)),
            cell(split.pacePerKm),
            cell(split.avgHr != null ? String(split.avgHr) : '—'),
            cell(split.maxHr != null ? String(split.maxHr) : '—'),
            cell(split.cadence != null ? String(split.cadence) : '—'),
            cell(split.strideCm != null ? String(split.strideCm) : '—'),
            cell(split.gctMs != null ? String(Math.round(split.gctMs)) : '—'),
            cell(split.powerW != null ? String(Math.round(split.powerW)) : '—'),
            cell(split.vertOscCm != null ? String(split.vertOscCm) : '—'),
            cell(split.vertRatioPct != null ? `${split.vertRatioPct}%` : '—'),
            cell(elevStr),
          ],
        },
      });
    }

    blocks.push({
      object: 'block',
      type: 'table',
      table: {
        table_width: 11,
        has_column_header: true,
        has_row_header: false,
        children: tableRows,
      },
    });
  }

  // HR Zones table
  if (run.hrZ1s != null || run.hrZ2s != null) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'HR Zones' } }],
      },
    });

    const zoneRows: object[] = [
      {
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: 'Zone' } }],
            [{ type: 'text', text: { content: 'Time' } }],
          ],
        },
      },
      ...[
        ['Z1 (Warm-up)', run.hrZ1s],
        ['Z2 (Easy)', run.hrZ2s],
        ['Z3 (Aerobic)', run.hrZ3s],
        ['Z4 (Threshold)', run.hrZ4s],
        ['Z5 (Max)', run.hrZ5s],
      ].map(([label, val]) => ({
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: String(label) } }],
            [{ type: 'text', text: { content: hrZoneStr(val as number | null) } }],
          ],
        },
      })),
    ];

    blocks.push({
      object: 'block',
      type: 'table',
      table: {
        table_width: 2,
        has_column_header: true,
        has_row_header: false,
        children: zoneRows,
      },
    });
  }

  // Observations
  const observations: string[] = [];
  if (run.perfCondition != null) {
    const sign = run.perfCondition > 0 ? '+' : '';
    observations.push(`Performance condition: ${sign}${run.perfCondition}`);
  }
  if (run.decouplingPct != null) {
    const coupling = run.decouplingPct <= 5 ? 'good aerobic coupling' : run.decouplingPct <= 10 ? 'moderate decoupling' : 'high decoupling';
    observations.push(`Aerobic decoupling: ${run.decouplingPct}% (${coupling})`);
  }
  if (run.avgPowerW != null) {
    observations.push(`Avg power: ${run.avgPowerW}W`);
  }
  if (run.weather) {
    const weatherStr = [
      run.weather,
      run.tempC != null ? `${run.tempC}°C` : null,
      run.humidityPct != null ? `${run.humidityPct}% humidity` : null,
    ].filter(Boolean).join(', ');
    observations.push(`Conditions: ${weatherStr}`);
  }
  if (run.trainingEffect) {
    observations.push(`Training effect: ${run.trainingEffect}`);
  }

  if (observations.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Observations' } }],
      },
    });

    for (const obs of observations) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: obs } }],
        },
      });
    }
  }

  return blocks;
}

function richText(text: string) {
  return [{ type: 'text', text: { content: text } }];
}

function buildProperties(run: RunActivity): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Run: { title: richText(run.name) },
    Date: { date: { start: run.date } },
    'Garmin ID': { rich_text: richText(run.garminId) },
  };

  if (run.distanceKm != null) props['Distance (km)'] = { number: run.distanceKm };
  if (run.durationFormatted) props['Duration'] = { rich_text: richText(run.durationFormatted) };
  if (run.avgPacePerKm) props['Avg Pace'] = { rich_text: richText(run.avgPacePerKm) };
  if (run.avgHr != null) props['Avg HR'] = { number: run.avgHr };
  if (run.maxHr != null) props['Max HR'] = { number: run.maxHr };
  if (run.calories != null) props['Calories'] = { number: run.calories };
  if (run.cadenceSpm != null) props['Cadence (spm)'] = { number: run.cadenceSpm };
  if (run.strideCm != null) props['Stride (cm)'] = { number: run.strideCm };
  if (run.gctMs != null) props['GCT (ms)'] = { number: run.gctMs };
  if (run.vertOscCm != null) props['Vert Osc (cm)'] = { number: run.vertOscCm };
  if (run.vertRatioPct != null) props['Vert Ratio (%)'] = { number: run.vertRatioPct };
  if (run.avgPowerW != null) props['Avg Power (W)'] = { number: run.avgPowerW };
  if (run.trainingLoad != null) props['Training Load'] = { number: run.trainingLoad };
  if (run.trainingEffect) props['Training Effect'] = { rich_text: richText(run.trainingEffect) };
  if (run.vo2Max != null) props['VO2 Max'] = { number: run.vo2Max };
  if (run.elevGainM != null) props['Elev Gain (m)'] = { number: run.elevGainM };
  if (run.fastestKmPace) props['Fastest Km'] = { rich_text: richText(run.fastestKmPace) };
  if (run.location) props['Location'] = { rich_text: richText(run.location) };
  if (run.tempC != null) props['Temp (C)'] = { number: run.tempC };
  if (run.feelsLikeC != null) props['Feels Like (C)'] = { number: run.feelsLikeC };
  if (run.humidityPct != null) props['Humidity (%)'] = { number: run.humidityPct };
  if (run.weather) props['Weather'] = { rich_text: richText(run.weather) };
  if (run.perfCondition != null) props['Perf Condition'] = { number: run.perfCondition };
  if (run.decouplingPct != null) props['Decoupling (%)'] = { number: run.decouplingPct };

  // HR Zones as rich text (formatted as "Z1: 7:21 | Z2: 17:50 | ...")
  const hrZones = [
    run.hrZ1s != null ? `Z1: ${hrZoneStr(run.hrZ1s)}` : null,
    run.hrZ2s != null ? `Z2: ${hrZoneStr(run.hrZ2s)}` : null,
    run.hrZ3s != null ? `Z3: ${hrZoneStr(run.hrZ3s)}` : null,
    run.hrZ4s != null ? `Z4: ${hrZoneStr(run.hrZ4s)}` : null,
    run.hrZ5s != null ? `Z5: ${hrZoneStr(run.hrZ5s)}` : null,
  ].filter(Boolean);
  if (hrZones.length > 0) {
    props['HR Zones'] = { rich_text: richText(hrZones.join(' | ')) };
  }

  return props;
}

/** Find an existing Runs DB page by Garmin ID, returns page ID or null */
export async function findRunPageByGarminId(apiKey: string, garminId: string): Promise<string | null> {
  const res = await fetch(`${NOTION_API}/databases/${RUNS_DB_ID}/query`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      filter: { property: 'Garmin ID', rich_text: { equals: garminId } },
      page_size: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0]?.id ?? null;
}

/** Create a new page in the Runs DB for the given activity */
export async function createRunPage(apiKey: string, run: RunActivity): Promise<string> {
  const properties = buildProperties(run);
  const children = buildPageContent(run);

  const body: Record<string, unknown> = {
    parent: { database_id: RUNS_DB_ID },
    properties,
  };

  if (children.length > 0) {
    body.children = children;
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion create page failed: ${err}`);
  }

  const data = await res.json();
  return data.id;
}

/** Patch properties and content on an existing Runs DB page (used by force_resync) */
export async function patchRunPage(apiKey: string, pageId: string, run: RunActivity): Promise<void> {
  // Update properties
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ properties: buildProperties(run) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion patch page failed: ${err}`);
  }

  // Delete existing children blocks and replace with new content
  try {
    const childrenRes = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
      headers: notionHeaders(apiKey),
    });
    if (childrenRes.ok) {
      const childrenData = await childrenRes.json();
      for (const block of childrenData.results ?? []) {
        await fetch(`${NOTION_API}/blocks/${block.id}`, {
          method: 'DELETE',
          headers: notionHeaders(apiKey),
        });
      }
    }

    // Append new content blocks
    const children = buildPageContent(run);
    if (children.length > 0) {
      await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
        method: 'PATCH',
        headers: notionHeaders(apiKey),
        body: JSON.stringify({ children }),
      });
    }
  } catch (err) {
    console.warn('[notion-runs-db] Could not update page content:', err);
  }
}

/** Patch only the Decoupling (%) property on an existing Runs DB page */
export async function patchDecouplingOnly(apiKey: string, pageId: string, decouplingPct: number | null): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (decouplingPct != null) {
    properties['Decoupling (%)'] = { number: decouplingPct };
  } else {
    properties['Decoupling (%)'] = { number: null };
  }
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion patch decoupling failed: ${err}`);
  }
}

/** Fetch all runs from the Runs DB for a date range, for analysis */
export async function getRunsForPeriod(
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<Record<string, unknown>[]> {
  const pages: Record<string, unknown>[] = [];
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const body: Record<string, unknown> = {
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
      headers: notionHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = await res.json();
    pages.push(...(data.results ?? []));
    hasMore = data.has_more ?? false;
    cursor = data.next_cursor ?? undefined;
  }

  // Deduplicate by Garmin ID — keep first occurrence (ascending date order)
  const seen = new Set<string>();
  return pages.filter((page) => {
    const gid = (page as Record<string, unknown> & { properties?: Record<string, unknown> })
      .properties?.['Garmin ID'];
    const garminId = (gid as { rich_text?: { plain_text: string }[] })?.rich_text?.[0]?.plain_text;
    if (garminId) {
      if (seen.has(garminId)) return false;
      seen.add(garminId);
    }
    return true;
  });
}

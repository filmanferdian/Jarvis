/**
 * Notion Runs Database read/write module.
 * Handles redundancy check (by Garmin ID) and page creation.
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const RUNS_DB_ID = '88f904d6-d50b-4261-a4db-2a224211a7b9';

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
  }[];
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

  // Per-Km Splits table
  if (run.splits.length > 0) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Per-Km Splits' } }],
      },
    });

    // Table header
    const tableRows: object[] = [
      {
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: 'Km' } }],
            [{ type: 'text', text: { content: 'Dist (m)' } }],
            [{ type: 'text', text: { content: 'Time' } }],
            [{ type: 'text', text: { content: 'Pace' } }],
            [{ type: 'text', text: { content: 'Avg HR' } }],
          ],
        },
      },
    ];

    for (const split of run.splits) {
      tableRows.push({
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: String(split.lapIndex) } }],
            [{ type: 'text', text: { content: String(Math.round(split.distanceMeters)) } }],
            [{ type: 'text', text: { content: secondsToTimeStr(split.durationSeconds) } }],
            [{ type: 'text', text: { content: split.pacePerKm } }],
            [{ type: 'text', text: { content: split.avgHr ? String(split.avgHr) : '—' } }],
          ],
        },
      });
    }

    blocks.push({
      object: 'block',
      type: 'table',
      table: {
        table_width: 5,
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

  return pages;
}

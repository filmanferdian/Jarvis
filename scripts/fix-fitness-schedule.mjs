#!/usr/bin/env node
/**
 * One-time fix for the Notion "Program Schedule" database.
 *
 * Issues fixed:
 *   1. Day numbers off by +7 after Day 49 (Days 50-56 were missing)
 *   2. Cardio values wrong — Wed/Sat should be runs, not walks; durations incorrect
 *
 * Usage:
 *   node --env-file=.env.local scripts/fix-fitness-schedule.mjs          # dry-run
 *   node --env-file=.env.local scripts/fix-fitness-schedule.mjs --apply  # apply changes
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const FITNESS_DB_ID = process.env.NOTION_FITNESS_DB_ID;
const DRY_RUN = !process.argv.includes('--apply');

if (!NOTION_API_KEY || !FITNESS_DB_ID) {
  console.error('Missing env vars: NOTION_API_KEY, NOTION_FITNESS_DB_ID');
  process.exit(1);
}

if (DRY_RUN) {
  console.log('=== DRY RUN — pass --apply to write changes ===\n');
}

// --- Correct cardio schedule from the transformation program ---

// Deload weeks: every 4th week
const DELOAD_WEEKS = new Set([4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52]);

function getWalkDuration(week) {
  if (week <= 4) return 20;
  if (week <= 9) return 25;
  if (week <= 12) return 30;
  return 30; // Phase 2+ maintenance
}

function getSaturdayRun(week) {
  const isDeload = DELOAD_WEEKS.has(week);
  // Exact values from the transformation program table (Weeks 1-12)
  const table = {
    1: 35, 2: 40, 3: 45, 4: 40, // Wk4 deload
    5: 50, 6: 50, 7: 50, 8: 45, // Wk8 deload
    9: 55, 10: 55, 11: 55, 12: 50, // Wk12 deload
  };
  if (table[week] !== undefined) return table[week];
  // Weeks 13+: maintain 55min, deload weeks 45min
  return isDeload ? 45 : 55;
}

function getSundayCardio(week) {
  const isDeload = DELOAD_WEEKS.has(week);
  if (isDeload) return 'REST';
  if (week <= 3) return '20min walk';
  if (week <= 4) return 'REST'; // deload
  if (week <= 8) return '25min walk';
  if (week <= 9) return '25min walk';
  if (week <= 11) return '30min walk';
  if (week <= 12) return 'REST'; // deload
  // Phase 2+
  return '30min walk';
}

function getCorrectCardio(week, dayOfWeek) {
  // dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  switch (dayOfWeek) {
    case 0: // Sunday
      return getSundayCardio(week);
    case 1: // Monday
    case 2: // Tuesday
    case 4: // Thursday
    case 5: // Friday
      return `${getWalkDuration(week)}min walk`;
    case 3: // Wednesday
      return '30min run';
    case 6: // Saturday
      return `${getSaturdayRun(week)}min run`;
    default:
      return 'REST';
  }
}

// --- Notion API helpers ---

async function notionFetch(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text}`);
  }
  return res.json();
}

async function queryAllPages() {
  const pages = [];
  let hasMore = true;
  let startCursor;

  while (hasMore) {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const data = await notionFetch(`/databases/${FITNESS_DB_ID}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    pages.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return pages;
}

function extractTitle(prop) {
  return prop?.title?.[0]?.plain_text || '';
}

function extractDate(prop) {
  return prop?.date?.start || '';
}

function extractNumber(prop) {
  return prop?.number ?? null;
}

function extractRichText(prop) {
  return prop?.rich_text?.map(t => t.plain_text).join('') || '';
}

function extractSelect(prop) {
  return prop?.select?.name || '';
}

function extractCheckbox(prop) {
  return prop?.checkbox ?? false;
}

async function updatePage(pageId, properties) {
  return notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

async function createPage(properties) {
  return notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: FITNESS_DB_ID },
      properties,
    }),
  });
}

// --- Main ---

async function main() {
  console.log('Fetching all pages from Program Schedule database...');
  const pages = await queryAllPages();
  console.log(`Found ${pages.length} pages\n`);

  // Parse all rows
  const rows = pages.map(page => {
    const p = page.properties;
    const dayLabel = extractTitle(p['Day']);
    const dayNum = parseInt(dayLabel.replace('Day ', ''), 10) || 0;
    return {
      pageId: page.id,
      dayLabel,
      dayNum,
      date: extractDate(p['Date']),
      week: extractNumber(p['Week']),
      phase: extractSelect(p['Phase']),
      dayType: extractSelect(p['Day Type']),
      cardio: extractRichText(p['Cardio']),
      training: extractRichText(p['Training']),
      calories: extractNumber(p['Calories']),
      protein: extractNumber(p['Protein']),
      carbs: extractNumber(p['Carbs']),
      fat: extractNumber(p['Fat']),
      eatingOpen: extractRichText(p['Eating Open']),
      eatingClose: extractRichText(p['Eating Close']),
      deload: extractCheckbox(p['Deload']),
      stepsTarget: extractNumber(p['Steps Target']),
    };
  });

  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Check for the gap
  const dayNums = rows.map(r => r.dayNum).sort((a, b) => a - b);
  const missing = [];
  for (let i = 1; i <= Math.max(...dayNums); i++) {
    if (!dayNums.includes(i)) missing.push(i);
  }
  if (missing.length > 0) {
    console.log(`Missing day numbers: ${missing.join(', ')}`);
  }

  // Track changes
  let dayFixCount = 0;
  let cardioFixCount = 0;
  const updates = [];

  for (const row of rows) {
    const changes = {};
    let changeDesc = [];

    // Fix 1: Day number — subtract 7 for days > 49
    let correctDayNum = row.dayNum;
    if (row.dayNum > 49) {
      correctDayNum = row.dayNum - 7;
      changes.Day = { title: [{ text: { content: `Day ${correctDayNum}` } }] };
      changeDesc.push(`Day ${row.dayNum} → Day ${correctDayNum}`);
      dayFixCount++;
    }

    // Fix 2: Cardio value based on week + day-of-week
    if (row.date && row.week) {
      const d = new Date(row.date + 'T00:00:00Z');
      const dayOfWeek = d.getUTCDay();
      const correctCardio = getCorrectCardio(row.week, dayOfWeek);

      if (row.cardio !== correctCardio) {
        changes.Cardio = { rich_text: [{ text: { content: correctCardio } }] };
        changeDesc.push(`Cardio: "${row.cardio}" → "${correctCardio}"`);
        cardioFixCount++;
      }
    }

    if (Object.keys(changes).length > 0) {
      updates.push({ pageId: row.pageId, changes, desc: changeDesc, row });
    }
  }

  // Report
  console.log(`\n=== Summary ===`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Day number fixes needed: ${dayFixCount}`);
  console.log(`Cardio fixes needed: ${cardioFixCount}`);
  console.log(`Total pages to update: ${updates.length}\n`);

  // Show first 20 changes as preview
  const previewCount = Math.min(updates.length, 20);
  console.log(`--- Preview (first ${previewCount} changes) ---`);
  for (let i = 0; i < previewCount; i++) {
    const u = updates[i];
    console.log(`  ${u.row.date} (Wk${u.row.week}): ${u.desc.join(', ')}`);
  }
  if (updates.length > previewCount) {
    console.log(`  ... and ${updates.length - previewCount} more`);
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN complete. Pass --apply to write changes. ===');
    return;
  }

  // Apply updates with rate limiting (3 req/sec to stay under Notion limits)
  console.log('\n=== Applying changes... ===');
  let done = 0;
  for (const u of updates) {
    await updatePage(u.pageId, u.changes);
    done++;
    if (done % 10 === 0) {
      console.log(`  Updated ${done}/${updates.length} pages...`);
    }
    // Rate limit: ~3 requests per second
    await new Promise(r => setTimeout(r, 350));
  }
  console.log(`\nDone! Updated ${done} pages.`);

  // Check if we need to create missing days 50-56
  const existingDayNums = new Set(rows.map(r => r.dayNum > 49 ? r.dayNum - 7 : r.dayNum));
  const stillMissing = [];
  for (let d = 50; d <= 56; d++) {
    if (!existingDayNums.has(d)) stillMissing.push(d);
  }

  if (stillMissing.length > 0) {
    console.log(`\nNote: Days ${stillMissing.join(', ')} are still missing from the database.`);
    console.log('These correspond to Week 8 (deload) days that were never created.');
    console.log('The existing Week 8 rows (formerly Days 57-63, now 50-56) should cover this week.');
    console.log('If there are truly missing dates, they may need manual creation.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

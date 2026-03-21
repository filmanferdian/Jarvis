import { supabase } from '@/lib/supabase';

// Notion page IDs for the transformation program
const PROGRAM_PAGE_ID = '2f2c674a-ecec-819d-ac40-c78f9fb5a517';
const PARENT_PAGE_ID = '2f2c674a-ecec-8078-9657-f4858a35305d';

export interface FitnessContext {
  current_week: number;
  current_phase: string;
  phase_end_week: number;
  phase_tone: string;
  training_day_map: Record<string, TrainingDay>;
  cardio_schedule: Record<string, string>;
  macro_training: MacroTargets;
  macro_rest: MacroTargets;
  eating_window: EatingWindow;
  milestones: Milestone[];
  next_deload_week: number;
  daily_habits: DailyHabits;
  special_notes: string;
  active_subpages: string[];
}

interface TrainingDay {
  type: string;
  focus: string;
  exercises: Exercise[];
  total_sets: number;
  duration: string;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface EatingWindow {
  open: string;
  close: string;
  pre_workout?: string;
}

interface Milestone {
  week: number;
  weight: string;
  marker: string;
}

interface DailyHabits {
  wake_time: string;
  cardio_time: string;
  training_time: string;
  sleep_target: string;
  wind_down: string;
  lights_out: string;
}

async function fetchNotionPage(pageId: string): Promise<string> {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) throw new Error('NOTION_API_KEY not configured');

  // Fetch page blocks (content)
  const blocks: string[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    url.searchParams.set('page_size', '100');
    if (startCursor) url.searchParams.set('start_cursor', startCursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
    const data = await res.json();

    for (const block of data.results) {
      const text = extractBlockText(block);
      if (text) blocks.push(text);

      // Recursively fetch table row children (Notion tables require a second fetch)
      if (block.type === 'table' && block.has_children) {
        const childRes = await fetch(
          `https://api.notion.com/v1/blocks/${block.id}/children?page_size=100`,
          {
            headers: {
              Authorization: `Bearer ${notionApiKey}`,
              'Notion-Version': '2022-06-28',
            },
          }
        );
        if (childRes.ok) {
          const childData = await childRes.json();
          for (const childBlock of childData.results) {
            const childText = extractBlockText(childBlock);
            if (childText) blocks.push(childText);
          }
        }
      }
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  return blocks.join('\n');
}

function extractBlockText(block: Record<string, unknown>): string {
  const type = block.type as string;
  const content = block[type] as Record<string, unknown> | undefined;
  if (!content) return '';

  // Handle table rows (cells array instead of rich_text)
  if (type === 'table_row') {
    const cells = content.cells as Array<Array<{ plain_text: string }>> | undefined;
    if (!cells) return '';
    return '| ' + cells.map(cell => cell.map(t => t.plain_text).join('')).join(' | ') + ' |';
  }

  const richText = content.rich_text as Array<{ plain_text: string }> | undefined;
  if (richText) {
    const text = richText.map((t) => t.plain_text).join('');
    if (type === 'heading_1') return `# ${text}`;
    if (type === 'heading_2') return `## ${text}`;
    if (type === 'heading_3') return `### ${text}`;
    if (type === 'bulleted_list_item') return `- ${text}`;
    if (type === 'numbered_list_item') return `- ${text}`;
    return text;
  }

  return '';
}

async function fetchChildPages(): Promise<{ title: string; id: string }[]> {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) throw new Error('NOTION_API_KEY not configured');

  const res = await fetch(`https://api.notion.com/v1/blocks/${PARENT_PAGE_ID}/children?page_size=100`, {
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
  const data = await res.json();

  return data.results
    .filter((b: Record<string, unknown>) => b.type === 'child_page')
    .map((b: Record<string, unknown>) => ({
      title: (b.child_page as { title: string })?.title || '',
      id: b.id as string,
    }));
}

async function fetchPageLastEdited(pageId: string): Promise<string> {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) throw new Error('NOTION_API_KEY not configured');

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
    },
  });

  if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
  const data = await res.json();
  return data.last_edited_time;
}

/**
 * Parse the current week number from the Notion milestones table.
 * The table has rows like: | 8 | Mar 16 – Mar 22, 2026 | 110kg | First 4kg lost |
 * We find the row whose date range contains today's date.
 * Falls back to hardcoded start date calculation if parsing fails.
 */
function parseCurrentWeekFromContent(content: string, todayWib: string): number {
  const today = new Date(todayWib + 'T00:00:00Z');

  // Month name to number mapping
  const months: Record<string, number> = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  // Match patterns like "Mar 16 – Mar 22, 2026" or "Jan 26 – Feb 1, 2026"
  const dateRangeRegex = /(\w{3})\s+(\d{1,2})\s*[–—-]\s*(\w{3})\s+(\d{1,2}),?\s*(\d{4})/g;
  const lines = content.split('\n');

  let bestWeek: number | null = null;

  for (const line of lines) {
    // Look for lines that have both a week number and a date range
    const weekMatch = line.match(/(?:^|\|)\s*(\d{1,2})\s*(?:\|)/);
    if (!weekMatch) continue;

    const weekNum = parseInt(weekMatch[1], 10);
    if (weekNum < 1 || weekNum > 52) continue;

    const rangeMatch = dateRangeRegex.exec(line);
    dateRangeRegex.lastIndex = 0; // Reset for next iteration
    if (!rangeMatch) continue;

    const startMonth = months[rangeMatch[1].toLowerCase()];
    const startDay = parseInt(rangeMatch[2], 10);
    const endMonth = months[rangeMatch[3].toLowerCase()];
    const endDay = parseInt(rangeMatch[4], 10);
    const year = parseInt(rangeMatch[5], 10);

    if (startMonth === undefined || endMonth === undefined) continue;

    const rangeStart = new Date(Date.UTC(year, startMonth, startDay));
    const rangeEnd = new Date(Date.UTC(year, endMonth, endDay, 23, 59, 59));

    if (today >= rangeStart && today <= rangeEnd) {
      bestWeek = weekNum;
      break;
    }

    // If today is between this milestone and the next, interpolate
    // e.g., if week 8 ends Mar 22 and today is Mar 25 (before week 12 starts),
    // compute offset days from this milestone's start
    if (today > rangeEnd) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysPastStart = Math.floor((today.getTime() - rangeStart.getTime()) / msPerDay);
      const weeksOffset = Math.floor(daysPastStart / 7);
      bestWeek = weekNum + weeksOffset;
    }
  }

  // Fallback: calculate from hardcoded start date if no match found
  if (bestWeek === null) {
    const programStart = new Date('2026-01-26T00:00:00+07:00');
    const wibDate = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceStart = Math.floor((wibDate.getTime() - programStart.getTime()) / msPerDay);
    bestWeek = Math.floor(daysSinceStart / 7) + 1;
    console.log(`[fitness] Week parsed from fallback calculation: ${bestWeek}`);
  } else {
    console.log(`[fitness] Week parsed from Notion milestones: ${bestWeek}`);
  }

  return bestWeek;
}

async function extractWithClaude(programContent: string, subpageContents: string[]): Promise<FitnessContext> {
  const apiKey = process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const subpageText = subpageContents.length > 0
    ? `\n\n--- REFERENCE SUB-PAGES ---\n${subpageContents.join('\n\n---\n\n')}`
    : '';

  // Compute today's date in WIB for accurate week calculation
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  const todayWib = wibDate.toISOString().split('T')[0];

  // Parse current week from Notion milestones table (week-date mapping)
  // Matches patterns like: "8" ... "Mar 16 – Mar 22, 2026" or "Week 8" ... date ranges
  const currentWeek = parseCurrentWeekFromContent(programContent, todayWib);

  const prompt = `You are extracting structured fitness program data from a Notion page. Extract the following JSON structure from the program content below. Be precise with numbers and exercise details.

IMPORTANT RULES:
1. Today's date is ${todayWib} (WIB timezone).
2. current_week MUST be ${currentWeek}. This was determined from the program's milestones table date ranges. Do NOT override this with any week number you find elsewhere in the content — use ${currentWeek} exactly.
3. Look at the program edit log at the bottom for the latest changes.
4. Sub-pages are provided as reference context. Only apply Ramadan-specific adjustments (eating window, schedule, macro changes) if Ramadan is currently active based on today's date. Outside of Ramadan, use the standard schedule and eating window from the main program content.
5. The cardio schedule varies by week. Look for the "WEEKS 1-12 CARDIO SCHEDULE" table — it has columns for each day (Mon, Tue, Wed, Thu, Fri, Sat, Sun). Extract cardio values from Week ${currentWeek}'s row and map each column to the corresponding day in cardio_schedule.

Return ONLY valid JSON matching this exact structure:
{
  "current_week": ${currentWeek},
  "current_phase": "<string — e.g. 'Phase 1: Foundation'>",
  "phase_end_week": <number>,
  "phase_tone": "<one of: encouraging_foundational, momentum_consistency, empathetic_grind, celebratory_finish>",
  "training_day_map": {
    "monday": { "type": "<e.g. Lower Strength>", "focus": "<brief>", "exercises": [{"name": "<exercise>", "sets": <n>, "reps": "<range>", "rest": "<time>", "notes": "<optional>"}], "total_sets": <n>, "duration": "<range>" },
    "tuesday": { ... },
    "wednesday": { "type": "Rest", "focus": "Cardio only" },
    "thursday": { ... },
    "friday": { ... },
    "saturday": { "type": "Rest", "focus": "Cardio only" },
    "sunday": { "type": "Rest", "focus": "Optional cardio" }
  },
  "cardio_schedule": {
    "monday": "<e.g. 30min walk>",
    "tuesday": "<e.g. 30min walk>",
    "wednesday": "<e.g. 30min run @ 130-143 BPM>",
    "thursday": "<e.g. 30min walk>",
    "friday": "<e.g. 30min walk>",
    "saturday": "<e.g. 55min run @ 130-143 BPM>",
    "sunday": "<e.g. 30min walk or REST>"
  },
  "macro_training": { "calories": <n>, "protein": <n>, "carbs": <n>, "fat": <n> },
  "macro_rest": { "calories": <n>, "protein": <n>, "carbs": <n>, "fat": <n> },
  "eating_window": { "open": "<HH:MM>", "close": "<HH:MM>", "pre_workout": "<HH:MM or null>" },
  "milestones": [{ "week": <n>, "weight": "<target>", "marker": "<description>" }, ...],
  "next_deload_week": <number — the next upcoming deload week>,
  "daily_habits": {
    "wake_time": "<HH:MM>",
    "cardio_time": "<HH:MM>",
    "training_time": "<HH:MM>",
    "sleep_target": "<hours>",
    "wind_down": "<HH:MM>",
    "lights_out": "<HH:MM>"
  },
  "special_notes": "<any current adaptations, overrides, or important context>"
}

--- PROGRAM CONTENT ---
${programContent}
${subpageText}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await res.json();
  const rawText = data.content?.[0]?.text || '{}';

  // Track Claude API usage
  try {
    const { trackServiceUsage } = await import('@/lib/rateLimit');
    await trackServiceUsage('claude', {
      tokens_input: data.usage?.input_tokens ?? 0,
      tokens_output: data.usage?.output_tokens ?? 0,
    });
  } catch { /* non-critical */ }

  // Extract JSON from response
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to extract JSON from Claude response');

  const parsed = JSON.parse(jsonMatch[0]) as FitnessContext;

  // Sanity check: if extracted week is unreasonably far from today, clamp it
  // Programs are 52 weeks max; current_week shouldn't exceed a reasonable upper bound
  if (parsed.current_week > 52) {
    console.warn(`Fitness extraction returned current_week=${parsed.current_week}, clamping to 52`);
    parsed.current_week = 52;
  }

  return parsed;
}

export interface FitnessSyncResult {
  synced: boolean;
  skipped: boolean;
  current_week: number;
  current_phase: string;
  timestamp: string;
}

export async function syncFitness(force = false): Promise<FitnessSyncResult> {
  const timestamp = new Date().toISOString();

  // Check last edit time (main page + child pages)
  const lastEdited = await fetchPageLastEdited(PROGRAM_PAGE_ID);
  const childPages = await fetchChildPages();
  const relevantSubpages = childPages.filter((p) =>
    p.title.includes('Ramadan') ||
    p.title.includes('VO2 Max') ||
    p.title.includes('Phase')
  );

  // Check subpage edit times to detect changes in child pages
  const subpageEditTimes: string[] = [];
  for (const sp of relevantSubpages) {
    try {
      const edited = await fetchPageLastEdited(sp.id);
      subpageEditTimes.push(edited);
    } catch { /* skip */ }
  }

  if (!force) {
    const { data: existing } = await supabase
      .from('fitness_context')
      .select('notion_last_edited, synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    if (existing?.notion_last_edited === lastEdited) {
      // Main page unchanged — also check if any subpage was edited after last sync
      const lastSynced = existing.synced_at ? new Date(existing.synced_at).getTime() : 0;
      const subpageChanged = subpageEditTimes.some(
        (t) => new Date(t).getTime() > lastSynced
      );
      if (!subpageChanged) {
        return {
          synced: false,
          skipped: true,
          current_week: 0,
          current_phase: '',
          timestamp,
        };
      }
      console.log('[fitness] Subpage edit detected after last sync, re-syncing');
    }
  }

  // Fetch program content
  const programContent = await fetchNotionPage(PROGRAM_PAGE_ID);

  // Build active subpage list for metadata
  const activeSubpages = childPages
    .filter((p) => p.title !== 'Transformation program' && p.title !== 'Checkpoint')
    .map((p) => p.title);

  // Fetch content of relevant sub-pages (limit to most relevant ones)
  const subpageContents: string[] = [];
  for (const sp of relevantSubpages.slice(0, 3)) {
    try {
      const content = await fetchNotionPage(sp.id);
      subpageContents.push(`## ${sp.title}\n${content}`);
    } catch {
      // Skip sub-pages that fail to fetch
    }
  }

  // Extract structured data via Claude
  const context = await extractWithClaude(programContent, subpageContents);

  // Upsert to Supabase (delete old, insert new — single row)
  await supabase.from('fitness_context').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await supabase.from('fitness_context').insert({
    current_week: context.current_week,
    current_phase: context.current_phase,
    phase_end_week: context.phase_end_week,
    phase_tone: context.phase_tone,
    training_day_map: context.training_day_map,
    cardio_schedule: context.cardio_schedule,
    macro_training: context.macro_training,
    macro_rest: context.macro_rest,
    eating_window: context.eating_window,
    milestones: context.milestones,
    next_deload_week: context.next_deload_week,
    daily_habits: context.daily_habits,
    special_notes: context.special_notes,
    active_subpages: activeSubpages,
    notion_page_id: PROGRAM_PAGE_ID,
    notion_last_edited: lastEdited,
    synced_at: timestamp,
  });

  if (error) throw error;

  return {
    synced: true,
    skipped: false,
    current_week: context.current_week,
    current_phase: context.current_phase,
    timestamp,
  };
}

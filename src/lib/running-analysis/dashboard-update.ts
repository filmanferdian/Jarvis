/**
 * Updates the Running Log Notion page dashboard after new runs are added.
 * Uses targeted update_content operations — never replaces the full page.
 *
 * Note: The Running Log page has a complex structure with AI agent instructions.
 * This module updates only the subtitle timestamp and run count.
 * Full dashboard updates (aerobic base table, latest run section, analysis)
 * are handled by the AI agent instructions on the page itself.
 */

import { WeeklyAnalysis } from './analysis-engine';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const RUNNING_LOG_PAGE_ID = '32bc674aecec81c881c0dff36e8d4538';

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

export interface DashboardUpdateResult {
  updated: boolean;
  message: string;
}

/** Fetch all block children of a page (paginated) */
async function fetchAllBlocks(apiKey: string, pageId: string): Promise<Record<string, unknown>[]> {
  const blocks: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const url = cursor
      ? `${NOTION_API}/blocks/${pageId}/children?start_cursor=${cursor}&page_size=100`
      : `${NOTION_API}/blocks/${pageId}/children?page_size=100`;

    const res = await fetch(url, { headers: notionHeaders(apiKey) });
    if (!res.ok) break;

    const data = await res.json();
    blocks.push(...(data.results ?? []));
    hasMore = data.has_more ?? false;
    cursor = data.next_cursor ?? undefined;
  }

  return blocks;
}

function extractPlainText(block: Record<string, unknown>): string {
  const type = block.type as string;
  const content = (block[type] as { rich_text?: { plain_text: string }[] }) ?? {};
  return content.rich_text?.map((t) => t.plain_text).join('') ?? '';
}

function patchRichText(text: string) {
  return { rich_text: [{ type: 'text', text: { content: text } }] };
}

/** Update the subtitle block that contains "Updated: DD Mon YYYY — N runs logged" */
async function updateSubtitle(
  apiKey: string,
  blocks: Record<string, unknown>[],
  analysis: WeeklyAnalysis,
  totalRuns: number
): Promise<boolean> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const latest = new Date(analysis.weekEnd);
  const dateStr = `${latest.getDate()} ${months[latest.getMonth()]} ${latest.getFullYear()}`;

  // Find the subtitle paragraph that contains "Updated:"
  const subtitleBlock = blocks.find((b) => {
    const text = extractPlainText(b);
    return text.includes('Updated:') && text.includes('runs logged');
  });

  if (!subtitleBlock) return false;

  const blockId = subtitleBlock.id as string;
  const type = subtitleBlock.type as string;
  const newText = `Updated: ${dateStr} — ${totalRuns} runs logged`;

  const res = await fetch(`${NOTION_API}/blocks/${blockId}`, {
    method: 'PATCH',
    headers: notionHeaders(apiKey),
    body: JSON.stringify({ [type]: patchRichText(newText) }),
  });

  return res.ok;
}

/** Update the Analysis section with this week's insights */
async function updateAnalysisSection(
  apiKey: string,
  blocks: Record<string, unknown>[],
  analysis: WeeklyAnalysis
): Promise<boolean> {
  // Find blocks containing the analysis section marker
  // Look for a block with "Analysis" heading near where we can insert insights
  const analysisHeadingIdx = blocks.findIndex((b) => {
    const text = extractPlainText(b);
    return text === 'Analysis' || text.includes('Weekly Insight') || text.includes('How was this week');
  });

  if (analysisHeadingIdx === -1) return false;

  // Find the next few paragraph blocks after the heading and update them
  // We update blocks that look like the 4-section analysis content
  const sectionMarkers = [
    { label: 'How was this week', content: analysis.howWasThisWeek },
    { label: "What's good", content: analysis.whatsGood },
    { label: 'What needs work', content: analysis.whatNeedsWork },
    { label: 'Focus next week', content: analysis.focusNextWeek },
  ];

  let updated = false;

  for (const { label, content } of sectionMarkers) {
    const block = blocks.find((b) => {
      const text = extractPlainText(b);
      return text.toLowerCase().includes(label.toLowerCase());
    });

    if (block) {
      const blockId = block.id as string;
      const type = block.type as string;

      // Preserve the label, update the content after the colon
      const currentText = extractPlainText(block);
      const colonIdx = currentText.indexOf(':');
      const prefix = colonIdx >= 0 ? currentText.slice(0, colonIdx + 1) : label + ':';
      const newText = `${prefix} ${content}`;

      const res = await fetch(`${NOTION_API}/blocks/${blockId}`, {
        method: 'PATCH',
        headers: notionHeaders(apiKey),
        body: JSON.stringify({ [type]: patchRichText(newText) }),
      });

      if (res.ok) updated = true;
    }
  }

  return updated;
}

export async function updateRunningLogDashboard(
  apiKey: string,
  analysis: WeeklyAnalysis,
  totalRuns: number
): Promise<DashboardUpdateResult> {
  try {
    const blocks = await fetchAllBlocks(apiKey, RUNNING_LOG_PAGE_ID);

    const subtitleUpdated = await updateSubtitle(apiKey, blocks, analysis, totalRuns);
    const analysisUpdated = await updateAnalysisSection(apiKey, blocks, analysis);

    if (!subtitleUpdated && !analysisUpdated) {
      return {
        updated: false,
        message: 'Could not locate subtitle or analysis blocks to update',
      };
    }

    const parts = [];
    if (subtitleUpdated) parts.push('subtitle');
    if (analysisUpdated) parts.push('analysis section');

    return {
      updated: true,
      message: `Updated ${parts.join(' and ')} on Running Log page`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { updated: false, message: `Dashboard update error: ${msg}` };
  }
}

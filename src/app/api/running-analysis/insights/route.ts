import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getWeeklyInsights } from '@/lib/running-analysis/weekly-insights-db';
import { getRunsForPeriod } from '@/lib/running-analysis/notion-runs-db';
import { extractRunSummaries } from '@/lib/running-analysis/analysis-engine';

const WIB_OFFSET = 7 * 60 * 60 * 1000;

// GET: Return all weekly insights + all runs for the Running Analysis page
export const GET = withAuth(async () => {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) {
    return NextResponse.json({ error: 'NOTION_API_KEY not configured' }, { status: 500 });
  }

  const todayWib = new Date(Date.now() + WIB_OFFSET).toISOString().split('T')[0];

  // Fetch independently so one failure doesn't block the other
  let insights: Awaited<ReturnType<typeof getWeeklyInsights>> = [];
  let recentRuns: ReturnType<typeof extractRunSummaries> = [];

  const [insightsResult, runsResult] = await Promise.allSettled([
    getWeeklyInsights(notionApiKey),
    getRunsForPeriod(notionApiKey, '2026-01-01', todayWib),
  ]);

  if (insightsResult.status === 'fulfilled') {
    insights = insightsResult.value;
  } else {
    console.error('[insights] Failed to fetch weekly insights:', insightsResult.reason);
  }

  if (runsResult.status === 'fulfilled') {
    recentRuns = extractRunSummaries(runsResult.value).reverse();
  } else {
    console.error('[insights] Failed to fetch runs:', runsResult.reason);
  }

  return NextResponse.json({ insights, recentRuns });
});

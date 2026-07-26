import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getWeeklyInsights } from '@/lib/running-analysis/weekly-insights-store';
import { getRunsForPeriod } from '@/lib/running-analysis/runs-repo';

const WIB_OFFSET = 7 * 60 * 60 * 1000;
// Runs before this are pre-plan and not worth listing. Supabase holds activities back to
// Nov 2025; the Notion DB this replaced only went back to Apr 2026.
const RUNS_FROM = '2026-01-01';

// GET: Return all weekly insights + all runs for the Running Analysis page
export const GET = withAuth(async () => {
  const todayWib = new Date(Date.now() + WIB_OFFSET).toISOString().split('T')[0];

  // Fetch independently so one failure doesn't block the other
  let insights: Awaited<ReturnType<typeof getWeeklyInsights>> = [];
  let recentRuns: Awaited<ReturnType<typeof getRunsForPeriod>> = [];

  const [insightsResult, runsResult] = await Promise.allSettled([
    getWeeklyInsights(),
    getRunsForPeriod(RUNS_FROM, todayWib),
  ]);

  if (insightsResult.status === 'fulfilled') {
    insights = insightsResult.value;
  } else {
    console.error('[insights] Failed to fetch weekly insights:', insightsResult.reason);
  }

  if (runsResult.status === 'fulfilled') {
    recentRuns = runsResult.value.reverse(); // newest first
  } else {
    console.error('[insights] Failed to fetch runs:', runsResult.reason);
  }

  return NextResponse.json({ insights, recentRuns });
});

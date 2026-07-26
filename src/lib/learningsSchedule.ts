import { markSynced } from '@/lib/syncTracker';
import { captureAiInsights, wibWeekStart } from '@/lib/sync/aiInsightsCapture';
import { logCronRun } from '@/lib/cronLog';
import { supabase } from '@/lib/supabase';

// Weekly capture WITHOUT its own cron-job.org entry.
//
// The external scheduler is configured by hand in a web UI, and there is no API
// for it in this project, so every new job is manual work. Instead this rides
// an existing registered job and gates itself.
//
// Host: the google-calendar cron, which fires at 07:00 / 10:00 / 13:00 / 16:00 /
// 19:00 / 22:00 WIB. Verified against cron_run_log: 42 runs and 42 successes in
// the last 7 days, including 07:00 WIB on 7 of 7 days. Gating to Sunday at or
// after 07:00 therefore lands the capture at Sunday 07:00 WIB, which is the
// intended schedule, with no scheduler change.
//
// To move the run to a different weekday or hour, edit the two constants below.
// To give it a real dedicated schedule later, point a new cron-job.org job at
// /api/cron/ai-insights-capture; the route works standalone and the gate here
// will simply never win the race.

const SYNC_TYPE = 'ai-insights-capture';
const RUN_DAY = 0; // 0 = Sunday, WIB
const RUN_HOUR = 7; // WIB, inclusive

export function isCaptureWindow(now = new Date()): boolean {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.getUTCDay() === RUN_DAY && wib.getUTCHours() >= RUN_HOUR;
}

/**
 * Has this week's capture already been banked?
 *
 * Gates on the week actually captured, not on elapsed time. A time-based gate
 * reads one shared `sync_status` timestamp that the on-demand route stamps too,
 * so any manual trigger inside the interval silently ate that week's scheduled
 * run. That is what happened on 2026-07-26: two on-demand runs on Saturday
 * closed a six-day window, and the real Sunday tick skipped without a trace.
 *
 * Asking "is there a capture row for this week_start" is idempotent, immune to
 * runs belonging to other weeks, and self-healing after a missed week. On a
 * query error it returns false so the capture still runs: a duplicate upsert is
 * harmless, a silently skipped week is not.
 */
async function alreadyCapturedThisWeek(weekStart: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('learning_capture_runs')
    .select('id')
    .eq('topic', 'ai')
    .eq('week_start', weekStart)
    .limit(1);
  if (error) {
    console.error('[ai-insights-capture] capture-run lookup failed:', error.message);
    return false;
  }
  return (data || []).length > 0;
}

/**
 * Runs the weekly capture if the window is open and this week is not yet banked.
 * Never throws: it is called from `after()` inside another job's route, and must
 * not be able to affect that job's result.
 */
export async function maybeCaptureAiInsights(force = false): Promise<void> {
  try {
    if (!force) {
      if (!isCaptureWindow()) return;
      if (await alreadyCapturedThisWeek(wibWeekStart())) return;
    }

    const start = Date.now();
    // Social is off here: the Nitter mirror is unreachable from Railway's egress
    // (connection-level failure, measured 2026-07-25). The local scheduled task
    // adds those items on top.
    const r = await captureAiInsights({ includeSocial: false, ranFrom: 'railway' });
    const msg = `captured ${r.inserted} items, ${r.sourcesOk.length} sources ok, ${r.sourcesFailed.length} failed`;

    await markSynced(SYNC_TYPE, 'success', r.inserted, r.sourcesFailed.join(', ').slice(0, 500) || undefined);
    await logCronRun(SYNC_TYPE, 'success', msg, Date.now() - start);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai-insights-capture] failed:', msg);
    // Deliberately does NOT call markSynced: sync_status is observability only
    // now, and stamping a failure here would misreport the last good capture.
    // The gate reads learning_capture_runs, whose row is only written after a
    // successful capture, so a failure leaves the gate open and the next
    // google-calendar tick (10:00 WIB, then 13:00, and so on) retries the same
    // Sunday.
    await logCronRun(SYNC_TYPE, 'error', msg.slice(0, 500)).catch(() => {});
  }
}

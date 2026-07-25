import { shouldSync, markSynced } from '@/lib/syncTracker';
import { captureAiInsights } from '@/lib/sync/aiInsightsCapture';
import { logCronRun } from '@/lib/cronLog';

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

// 6 days, not 7: the gate must reopen before the next Sunday tick, otherwise a
// run that lands a few minutes late pushes the following week's run out by one
// whole cycle and the schedule drifts.
const MIN_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

export function isCaptureWindow(now = new Date()): boolean {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.getUTCDay() === RUN_DAY && wib.getUTCHours() >= RUN_HOUR;
}

/**
 * Runs the weekly capture if the window is open and it has not run recently.
 * Never throws: it is called from `after()` inside another job's route, and must
 * not be able to affect that job's result.
 */
export async function maybeCaptureAiInsights(force = false): Promise<void> {
  try {
    if (!force) {
      if (!isCaptureWindow()) return;
      if (!(await shouldSync(SYNC_TYPE, MIN_INTERVAL_MS))) return;
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
    // Deliberately does NOT call markSynced. markSynced stamps last_synced_at
    // regardless of the result it records, and shouldSync only reads that
    // timestamp, so marking a failure here would shut the gate for six days and
    // silently skip the week. Logging only leaves the gate open, so the next
    // google-calendar tick (10:00 WIB, then 13:00, and so on) retries the same
    // Sunday.
    await logCronRun(SYNC_TYPE, 'error', msg.slice(0, 500)).catch(() => {});
  }
}

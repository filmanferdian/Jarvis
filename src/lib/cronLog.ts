import { supabase } from './supabase';
import { markSynced } from './syncTracker';

export async function logCronRun(
  jobName: string,
  status: 'success' | 'error',
  message?: string,
  durationMs?: number,
) {
  await supabase.from('cron_run_log').insert({
    job_name: jobName,
    status,
    message: message ?? null,
    duration_ms: durationMs ?? null,
  });
}

export type CronJobResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function runCronJob<T>(
  jobName: string,
  fn: () => Promise<T>,
  opts?: {
    itemsCount?: (data: T) => number;
    message?: (data: T) => string;
  },
): Promise<CronJobResult<T>> {
  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    await markSynced(jobName, 'success', opts?.itemsCount?.(data) ?? 0);
    await logCronRun(jobName, 'success', opts?.message?.(data), duration);
    return { ok: true, data };
  } catch (err) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    await markSynced(jobName, 'error', 0, message.slice(0, 500));
    await logCronRun(jobName, 'error', message.slice(0, 500), duration);
    return { ok: false, error: message };
  }
}

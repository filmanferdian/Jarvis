import { supabase } from './supabase';

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

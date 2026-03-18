import { supabase } from './supabase';

export async function shouldSync(syncType: string, minIntervalMs: number): Promise<boolean> {
  const { data } = await supabase
    .from('sync_status')
    .select('last_synced_at')
    .eq('sync_type', syncType)
    .single();

  if (!data) return true; // No record = never synced

  const lastSynced = new Date(data.last_synced_at).getTime();
  return Date.now() - lastSynced >= minIntervalMs;
}

export async function markSynced(
  syncType: string,
  result: 'success' | 'error',
  eventsSynced?: number,
  errorMsg?: string,
): Promise<void> {
  await supabase.from('sync_status').upsert(
    {
      sync_type: syncType,
      last_synced_at: new Date().toISOString(),
      last_result: result,
      last_error: errorMsg || null,
      events_synced: eventsSynced || 0,
    },
    { onConflict: 'sync_type' },
  );
}

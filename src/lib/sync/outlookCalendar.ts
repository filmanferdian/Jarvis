import { supabase } from '@/lib/supabase';
import {
  getValidAccessToken,
  fetchCalendarView,
  transformGraphEvent,
} from '@/lib/microsoft';

export interface SyncResult {
  synced: number;
  date: string;
  timestamp: string;
  error?: string;
}

export async function syncOutlookCalendar(): Promise<SyncResult> {
  const accessToken = await getValidAccessToken();

  // Compute WIB today boundaries
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  const today = wibDate.toISOString().split('T')[0];

  const dayStart = `${today}T00:00:00+07:00`;
  const dayEnd = `${today}T23:59:59+07:00`;
  const nextDayStart = new Date(new Date(`${today}T00:00:00+07:00`).getTime() + 86400000)
    .toISOString();

  const graphEvents = await fetchCalendarView(accessToken, dayStart, dayEnd);
  const events = graphEvents.map(transformGraphEvent);

  // Delete today's outlook events, then upsert fresh ones
  await supabase
    .from('calendar_events')
    .delete()
    .eq('source', 'outlook')
    .gte('start_time', dayStart)
    .lt('start_time', nextDayStart);

  if (events.length > 0) {
    const { error } = await supabase
      .from('calendar_events')
      .upsert(events, { onConflict: 'event_id' });

    if (error) throw error;
  }

  return {
    synced: events.length,
    date: today,
    timestamp: now.toISOString(),
  };
}

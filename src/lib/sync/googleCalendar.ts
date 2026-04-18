import { supabase } from '@/lib/supabase';
import {
  getAllConnectedAccounts,
  getValidAccessToken,
  fetchCalendarEvents,
  transformGoogleEvent,
} from '@/lib/google';
import { markAccountSynced } from '@/lib/syncTracker';

const SYNC_TYPE = 'google-calendar';

export interface SyncResult {
  synced: number;
  accounts: string[];
  date: string;
  timestamp: string;
  errors?: string[];
}

// filmanferdian21@gmail.com is email-only (no calendar sync needed)
const CALENDAR_SKIP_ACCOUNTS = ['filmanferdian21@gmail.com'];

export async function syncGoogleCalendar(): Promise<SyncResult> {
  const allAccounts = await getAllConnectedAccounts();
  const accounts = allAccounts.filter((a) => !CALENDAR_SKIP_ACCOUNTS.includes(a.email));

  if (accounts.length === 0) {
    throw new Error('No Google accounts connected for calendar sync');
  }

  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  const today = wibDate.toISOString().split('T')[0];

  const dayStart = `${today}T00:00:00+07:00`;
  const dayEnd = `${today}T23:59:59+07:00`;
  const nextDayStart = new Date(new Date(`${today}T00:00:00+07:00`).getTime() + 86400000)
    .toISOString();

  let totalSynced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    const accountKey = `google:${account.email}`;
    try {
      const accessToken = await getValidAccessToken(account.id);
      const calEvents = await fetchCalendarEvents(accessToken, dayStart, dayEnd);
      const source = `google:${account.email}`;
      const events = calEvents.map((e) => transformGoogleEvent(e, source));

      await supabase
        .from('calendar_events')
        .delete()
        .eq('source', source)
        .gte('start_time', dayStart)
        .lt('start_time', nextDayStart);

      if (events.length > 0) {
        const { error } = await supabase
          .from('calendar_events')
          .upsert(events, { onConflict: 'event_id' });

        if (error) throw error;
      }

      totalSynced += events.length;
      await markAccountSynced(SYNC_TYPE, accountKey, 'success', events.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${account.email}: ${msg}`);
      await markAccountSynced(SYNC_TYPE, accountKey, 'error', 0, msg);
    }
  }

  return {
    synced: totalSynced,
    accounts: accounts.map((a) => a.email),
    date: today,
    timestamp: now.toISOString(),
    errors: errors.length > 0 ? errors : undefined,
  };
}

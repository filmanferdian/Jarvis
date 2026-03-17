import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  getValidAccessToken,
  fetchCalendarView,
  transformGraphEvent,
} from '@/lib/microsoft';

// POST: Sync today's Outlook calendar events to Supabase
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    // Get a valid access token (auto-refreshes if expired)
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'NO_TOKENS' || message.includes('refresh failed')) {
        return NextResponse.json(
          { error: 'Microsoft auth required', authUrl: '/api/auth/microsoft' },
          { status: 401 },
        );
      }
      throw err;
    }

    // Compute WIB today boundaries
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    const dayStart = `${today}T00:00:00+07:00`;
    const dayEnd = `${today}T23:59:59+07:00`;
    const nextDayStart = new Date(new Date(`${today}T00:00:00+07:00`).getTime() + 86400000)
      .toISOString();

    // Fetch events from Microsoft Graph
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

    return NextResponse.json({
      synced: events.length,
      date: today,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('Outlook sync error:', err);
    return NextResponse.json(
      { error: 'Outlook sync failed', details: String(err) },
      { status: 500 },
    );
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Fetch today's calendar events
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Use WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    const dayStart = `${today}T00:00:00+07:00`;
    const dayEnd = `${today}T23:59:59+07:00`;

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      date: today,
      events: data ?? [],
      count: data?.length ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
});

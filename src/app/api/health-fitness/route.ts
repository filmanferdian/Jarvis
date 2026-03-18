import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Today's health & fitness snapshot for the dashboard
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // WIB today
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    // Today's Garmin daily summary
    const { data: garminDaily } = await supabase
      .from('garmin_daily')
      .select('*')
      .eq('date', today)
      .single();

    // Latest activity (most recent)
    const { data: latestActivity } = await supabase
      .from('garmin_activities')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Weight trend (last 30 days)
    const thirtyDaysAgo = new Date(wibDate.getTime() - 30 * 86400000)
      .toISOString()
      .split('T')[0];

    const { data: weightTrend } = await supabase
      .from('weight_log')
      .select('date, weight_kg')
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: true });

    // Latest weight
    const { data: latestWeight } = await supabase
      .from('weight_log')
      .select('date, weight_kg')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      date: today,
      garmin: garminDaily || null,
      latestActivity: latestActivity || null,
      weight: {
        current: latestWeight || null,
        trend: weightTrend || [],
      },
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('Health fitness error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch health data', details: String(err) },
      { status: 500 },
    );
  }
});

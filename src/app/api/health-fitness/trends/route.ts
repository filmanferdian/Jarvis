import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Mapping of metric names to their source tables and columns
const METRIC_SOURCES: Record<string, { table: string; column: string; dateColumn: string }> = {
  weight: { table: 'weight_log', column: 'weight_kg', dateColumn: 'date' },
  steps: { table: 'garmin_daily', column: 'steps', dateColumn: 'date' },
  resting_hr: { table: 'garmin_daily', column: 'resting_hr', dateColumn: 'date' },
  vo2_max: { table: 'garmin_daily', column: 'vo2_max', dateColumn: 'date' },
  sleep_score: { table: 'garmin_daily', column: 'sleep_score', dateColumn: 'date' },
  sleep_duration: { table: 'garmin_daily', column: 'sleep_duration_seconds', dateColumn: 'date' },
  stress_level: { table: 'garmin_daily', column: 'stress_level', dateColumn: 'date' },
  hrv_7d_avg: { table: 'garmin_daily', column: 'hrv_7d_avg', dateColumn: 'date' },
  body_battery: { table: 'garmin_daily', column: 'body_battery', dateColumn: 'date' },
  training_readiness: { table: 'garmin_daily', column: 'training_readiness', dateColumn: 'date' },
  fitness_age: { table: 'garmin_daily', column: 'fitness_age', dateColumn: 'date' },
  body_fat: { table: 'health_measurements', column: 'value', dateColumn: 'date' },
  waist_circumference: { table: 'health_measurements', column: 'value', dateColumn: 'date' },
  blood_pressure_systolic: { table: 'health_measurements', column: 'value', dateColumn: 'date' },
  blood_pressure_diastolic: { table: 'health_measurements', column: 'value', dateColumn: 'date' },
};

// GET: Fetch time-series data for a metric
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const metric = req.nextUrl.searchParams.get('metric');
    const daysStr = req.nextUrl.searchParams.get('days') || '56';
    const days = parseInt(daysStr, 10) || 56;

    if (!metric || !METRIC_SOURCES[metric]) {
      return NextResponse.json(
        { error: `metric must be one of: ${Object.keys(METRIC_SOURCES).join(', ')}` },
        { status: 400 },
      );
    }

    const source = METRIC_SOURCES[metric];
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const startDate = new Date(wibDate.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = startDate.toISOString().split('T')[0];

    let data: { date: string; value: number }[] = [];

    if (source.table === 'health_measurements') {
      const { data: rows } = await supabase
        .from('health_measurements')
        .select('date, value')
        .eq('measurement_type', metric)
        .gte('date', startStr)
        .order('date');

      data = (rows || []).map((r) => ({ date: r.date, value: Number(r.value) }));
    } else if (source.table === 'weight_log') {
      const { data: rows } = await supabase
        .from('weight_log')
        .select('date, weight_kg')
        .gte('date', startStr)
        .order('date');

      data = (rows || []).map((r) => ({ date: r.date, value: Number(r.weight_kg) }));
    } else {
      // garmin_daily — select all columns and pick dynamically
      const { data: rows } = await supabase
        .from('garmin_daily')
        .select('*')
        .gte('date', startStr)
        .order('date');

      data = (rows || [])
        .filter((r) => r[source.column as keyof typeof r] != null)
        .map((r) => ({
          date: r.date,
          value: Number(r[source.column as keyof typeof r]),
        }));
    }

    // Convert sleep duration to hours if applicable
    if (metric === 'sleep_duration') {
      data = data.map((d) => ({ ...d, value: Math.round((d.value / 3600) * 10) / 10 }));
    }

    return NextResponse.json({
      metric,
      days,
      data_points: data.length,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Trends error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 },
    );
  }
});

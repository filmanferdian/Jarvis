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

    // Extract qualifier labels from raw_json
    let garminWithQualifiers = garminDaily || null;
    if (garminDaily?.raw_json) {
      const raw = garminDaily.raw_json as Record<string, unknown>;

      // Sleep qualifier: raw_json.sleep.dailySleepDTO.sleepScores.overall.qualifierKey
      const sleepQualifier =
        ((((raw.sleep as Record<string, unknown>)?.dailySleepDTO as Record<string, unknown>)
          ?.sleepScores as Record<string, unknown>)?.overall as Record<string, unknown>)
          ?.qualifierKey as string | undefined;

      // Stress qualifier: Garmin official ranges (0-25 Rest, 26-50 Low, 51-75 Medium, 76-100 High)
      const stressLevel = garminDaily.stress_level as number | null;
      const stressQualifier = stressLevel != null
        ? stressLevel <= 25 ? 'REST' : stressLevel <= 50 ? 'LOW' : stressLevel <= 75 ? 'MEDIUM' : 'HIGH'
        : null;

      // Body battery qualifier: last entry in bodyBatteryValuesArray, index 1 is status string
      const bbArray = (raw.stress as Record<string, unknown>)?.bodyBatteryValuesArray as unknown[][] | null;
      const lastBBEntry = bbArray && bbArray.length > 0 ? bbArray[bbArray.length - 1] : null;
      let bodyBatteryQualifier = lastBBEntry ? (lastBBEntry[1] as string | undefined) : null;
      if (!bodyBatteryQualifier && garminDaily.body_battery != null) {
        const bb = garminDaily.body_battery as number;
        bodyBatteryQualifier = bb >= 76 ? 'CHARGED' : bb >= 26 ? 'MODERATE' : 'DRAINED';
      }

      // Training readiness qualifier: check trainingReadiness array for level key
      const trArray = raw.trainingReadiness as Record<string, unknown>[] | null;
      let trainingReadinessQualifier = Array.isArray(trArray) && trArray.length > 0
        ? (trArray[0].level as string | undefined) ?? (trArray[0].qualifier as string | undefined) ?? null
        : null;
      if (!trainingReadinessQualifier && garminDaily.training_readiness != null) {
        const tr = garminDaily.training_readiness as number;
        trainingReadinessQualifier = tr >= 70 ? 'GOOD' : tr >= 40 ? 'MODERATE' : 'LOW';
      }

      // HRV qualifier: already stored as hrv_status
      const hrvQualifier = garminDaily.hrv_status as string | null;

      // Resting HR qualifier: derive from value
      const restingHr = garminDaily.resting_hr as number | null;
      const restingHrQualifier = restingHr != null
        ? restingHr < 60 ? 'ATHLETIC' : restingHr <= 80 ? 'NORMAL' : 'ELEVATED'
        : null;

      garminWithQualifiers = {
        ...garminDaily,
        sleep_qualifier: sleepQualifier ?? null,
        stress_qualifier: stressQualifier,
        body_battery_qualifier: bodyBatteryQualifier ?? null,
        training_readiness_qualifier: trainingReadinessQualifier,
        hrv_qualifier: hrvQualifier,
        resting_hr_qualifier: restingHrQualifier,
      };
    }

    return NextResponse.json({
      date: today,
      garmin: garminWithQualifiers,
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

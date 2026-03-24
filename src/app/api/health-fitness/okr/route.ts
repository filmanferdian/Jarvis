import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface OkrTarget {
  objective: string;
  key_result: string;
  target_value: number;
  target_direction: string;
  target_min: number | null;
  target_max: number | null;
  unit: string;
  baseline_value: number | null;
  source_table: string | null;
  source_column: string | null;
}

interface KrProgress {
  key_result: string;
  target_value: number;
  target_direction: string;
  unit: string;
  baseline_value: number | null;
  current_value: number | null;
  progress_pct: number | null;
  last_updated: string | null;
  status: 'on_track' | 'behind' | 'off_track' | 'no_data';
  context?: string;
}

interface ObjectiveProgress {
  objective: string;
  label: string;
  key_results: KrProgress[];
  overall_pct: number | null;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  O1: 'Body Composition',
  O2: 'Cardiovascular Capacity',
  O3: 'Functional Durability',
  O4: 'Metabolic & Hormonal',
  O5: 'Recovery Quality',
};

export const GET = withAuth(async () => {
  try {
    // Fetch all active targets
    const { data: targets, error: targetsErr } = await supabase
      .from('okr_targets')
      .select('*')
      .eq('is_active', true)
      .order('objective');

    if (targetsErr) throw targetsErr;
    if (!targets || targets.length === 0) {
      return NextResponse.json({ objectives: [], message: 'No OKR targets configured' });
    }

    // Fetch last 8 days of Garmin data (we exclude today for averages, keep it for latest)
    const { data: garminRows } = await supabase
      .from('garmin_daily')
      .select('*')
      .order('date', { ascending: false })
      .limit(8);

    const latestGarmin = garminRows?.[0] ?? null;

    // Exclude today from averaging — today's data is incomplete (day still in progress)
    const wibOffset = 7 * 60 * 60 * 1000;
    const todayWib = new Date(Date.now() + wibOffset).toISOString().split('T')[0];
    const completedDays = (garminRows ?? []).filter((r) => r.date !== todayWib).slice(0, 7);

    // Metrics that should use 7-day average (daily fluctuating values)
    const AVERAGED_METRICS = ['resting_hr', 'steps', 'sleep_duration_seconds', 'stress_level', 'body_battery', 'hrv_7d_avg'];

    // Compute 7-day averages for daily metrics (excluding today)
    const garmin7dAvg: Record<string, number | null> = {};
    if (completedDays.length > 0) {
      for (const col of AVERAGED_METRICS) {
        const values = completedDays
          .map((r) => r[col] as number | null)
          .filter((v): v is number => v != null);
        garmin7dAvg[col] = values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
          : null;
      }
    }

    // --- Dynamic baseline computation from earliest Garmin data ---
    // For metrics with NULL baseline_value, compute from the 7 earliest days of Garmin data
    // (proxy for "7 days prior to program start")
    const { data: earliestGarminRows } = await supabase
      .from('garmin_daily')
      .select('*')
      .order('date', { ascending: true })
      .limit(7);

    const garminEarlyAvg: Record<string, number | null> = {};
    if (earliestGarminRows && earliestGarminRows.length > 0) {
      const garminCols = [...AVERAGED_METRICS, 'vo2_max', 'fitness_age'];
      for (const col of garminCols) {
        const values = earliestGarminRows
          .map((r) => r[col] as number | null)
          .filter((v): v is number => v != null);
        garminEarlyAvg[col] = values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
          : null;
      }
    }

    // Earliest weight baseline
    const { data: earliestWeights } = await supabase
      .from('weight_log')
      .select('weight_kg')
      .order('date', { ascending: true })
      .limit(7);

    const earlyWeightAvg = earliestWeights && earliestWeights.length > 0
      ? Math.round(
          (earliestWeights.reduce((sum, w) => sum + Number(w.weight_kg), 0) / earliestWeights.length) * 10
        ) / 10
      : null;

    const { data: latestWeight } = await supabase
      .from('weight_log')
      .select('weight_kg, date')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Health measurements: get latest per type
    const { data: measurements } = await supabase
      .from('health_measurements')
      .select('measurement_type, value, date')
      .order('date', { ascending: false });

    const latestMeasurement: Record<string, { value: number; date: string }> = {};
    if (measurements) {
      for (const m of measurements) {
        if (!latestMeasurement[m.measurement_type]) {
          latestMeasurement[m.measurement_type] = { value: Number(m.value), date: m.date };
        }
      }
    }

    // Blood work: get latest per marker
    const { data: bloodWork } = await supabase
      .from('blood_work')
      .select('marker_name, value, test_date')
      .order('test_date', { ascending: false });

    const latestBlood: Record<string, { value: number; date: string }> = {};
    if (bloodWork) {
      for (const b of bloodWork) {
        if (!latestBlood[b.marker_name]) {
          latestBlood[b.marker_name] = { value: Number(b.value), date: b.test_date };
        }
      }
    }

    // Training completion: count strength_training activities in last 7 days vs 4 expected
    const sevenDaysAgo = new Date(Date.now() + wibOffset - 7 * 86400000).toISOString();
    const { data: recentActivities } = await supabase
      .from('garmin_activities')
      .select('activity_type')
      .eq('activity_type', 'strength_training')
      .gte('started_at', sevenDaysAgo);
    const trainingCompletion = recentActivities
      ? Math.min(100, Math.round((recentActivities.length / 4) * 100))
      : null;

    // --- HRV week-over-week decline computation ---
    // Current week = Mon-today, Previous week = Mon-Sun before that
    const todayDate = new Date(Date.now() + wibOffset);
    const todayDay = todayDate.getUTCDay(); // 0=Sun, 1=Mon, ...
    const daysSinceMonday = todayDay === 0 ? 6 : todayDay - 1;

    // Current week Monday
    const currentWeekMon = new Date(todayDate);
    currentWeekMon.setUTCDate(currentWeekMon.getUTCDate() - daysSinceMonday);
    const currentWeekMonStr = currentWeekMon.toISOString().split('T')[0];

    // Previous week Monday and Sunday
    const prevWeekMon = new Date(currentWeekMon);
    prevWeekMon.setUTCDate(prevWeekMon.getUTCDate() - 7);
    const prevWeekMonStr = prevWeekMon.toISOString().split('T')[0];
    const prevWeekSun = new Date(currentWeekMon);
    prevWeekSun.setUTCDate(prevWeekSun.getUTCDate() - 1);
    const prevWeekSunStr = prevWeekSun.toISOString().split('T')[0];

    const { data: hrvWeekRows } = await supabase
      .from('garmin_daily')
      .select('date, hrv_7d_avg')
      .gte('date', prevWeekMonStr)
      .lte('date', todayWib)
      .not('hrv_7d_avg', 'is', null);

    let hrvDeclinePct: number | null = null;
    let hrvPrevWeekAvg: number | null = null;
    let hrvCurrentWeekAvg: number | null = null;

    if (hrvWeekRows && hrvWeekRows.length > 0) {
      const prevWeekVals = hrvWeekRows
        .filter((r) => r.date >= prevWeekMonStr && r.date <= prevWeekSunStr)
        .map((r) => r.hrv_7d_avg as number);
      // Exclude today from current week
      const currentWeekVals = hrvWeekRows
        .filter((r) => r.date >= currentWeekMonStr && r.date !== todayWib)
        .map((r) => r.hrv_7d_avg as number);

      if (prevWeekVals.length > 0 && currentWeekVals.length > 0) {
        hrvPrevWeekAvg = Math.round((prevWeekVals.reduce((a, b) => a + b, 0) / prevWeekVals.length) * 10) / 10;
        hrvCurrentWeekAvg = Math.round((currentWeekVals.reduce((a, b) => a + b, 0) / currentWeekVals.length) * 10) / 10;
        const decline = ((hrvPrevWeekAvg - hrvCurrentWeekAvg) / hrvPrevWeekAvg) * 100;
        hrvDeclinePct = Math.max(0, Math.round(decline * 10) / 10); // 0 if HRV improved
      }
    }

    // Resolve current values for each target
    function resolveCurrentValue(t: OkrTarget): { value: number | null; date: string | null } {
      // HRV decline — week-over-week comparison
      if (t.key_result === 'hrv_decline_pct') {
        return { value: hrvDeclinePct, date: todayWib };
      }

      // Training completion — computed from Garmin activities
      if (t.key_result === 'training_completion') {
        return { value: trainingCompletion, date: todayWib };
      }

      // Weight special case
      if (t.key_result === 'weight' && latestWeight) {
        return { value: Number(latestWeight.weight_kg), date: latestWeight.date };
      }

      // Garmin daily metrics
      if (t.source_table === 'garmin_daily' && garminRows && garminRows.length > 0 && t.source_column) {
        // Use 7-day average for daily fluctuating metrics, latest non-null for stable ones (vo2_max, fitness_age)
        const useAverage = AVERAGED_METRICS.includes(t.source_column);
        let val: number | null;
        if (useAverage) {
          val = garmin7dAvg[t.source_column] ?? null;
        } else {
          // Find most recent row with a non-null value for this column
          const row = garminRows.find((r) => r[t.source_column!] != null);
          val = row ? (row[t.source_column] as number | null) : null;
        }
        // Convert sleep_duration_seconds to hours for sleep_hours KR
        if (t.key_result === 'sleep_hours' && val != null) {
          val = Math.round((val / 3600) * 10) / 10;
        }
        const dateSource = useAverage ? garminRows[0] : garminRows.find((r) => r[t.source_column!] != null);
        return { value: val ?? null, date: dateSource?.date ?? garminRows[0].date };
      }

      // Health measurements — map key_result to actual measurement_type
      if (t.source_table === 'health_measurements') {
        const typeMap: Record<string, string> = {
          dead_hang_seconds: 'dead_hang',
          overhead_squat_compensations: 'ohs_major_compensations',
          waist_cm: 'waist_circumference',
          bp_systolic: 'blood_pressure_systolic',
          bp_diastolic: 'blood_pressure_diastolic',
        };
        const measurementKey = typeMap[t.key_result] || t.key_result;
        const m = latestMeasurement[measurementKey];
        return m ? { value: m.value, date: m.date } : { value: null, date: null };
      }

      // Blood work
      if (t.source_table === 'blood_work') {
        const b = latestBlood[t.key_result];
        return b ? { value: b.value, date: b.date } : { value: null, date: null };
      }

      return { value: null, date: null };
    }

    // Resolve effective baseline: DB value OR dynamically computed from earliest data
    function resolveBaseline(t: OkrTarget): number | null {
      // HRV decline: baseline is always 0% (no decline), show prev week avg as context
      if (t.key_result === 'hrv_decline_pct') return 0;

      if (t.baseline_value != null) return t.baseline_value;

      // Weight: use earliest weight log average
      if (t.key_result === 'weight') return earlyWeightAvg;

      // Garmin-sourced metrics: use earliest Garmin data average
      if (t.source_table === 'garmin_daily' && t.source_column) {
        let val = garminEarlyAvg[t.source_column] ?? null;
        // Convert sleep_duration_seconds to hours
        if (t.key_result === 'sleep_hours' && val != null) {
          val = Math.round((val / 3600) * 10) / 10;
        }
        return val;
      }

      return null;
    }

    function computeProgress(baseline: number | null, target: number, direction: string, current: number | null, targetMin: number | null, targetMax: number | null): number | null {
      if (current == null || baseline == null) return null;

      if (direction === 'lower_is_better') {
        if (baseline === target) return 100;
        const pct = ((baseline - current) / (baseline - target)) * 100;
        return Math.max(0, Math.min(100, Math.round(pct)));
      } else if (direction === 'higher_is_better') {
        if (baseline === target) return 100;
        const pct = ((current - baseline) / (target - baseline)) * 100;
        return Math.max(0, Math.min(100, Math.round(pct)));
      }
      // range: check if within or above target_min-target_max
      if (targetMin != null && targetMax != null) {
        if (current >= targetMin) return 100;
        if (baseline !== targetMin) {
          const pct = ((current - baseline) / (targetMin - baseline)) * 100;
          return Math.max(0, Math.min(100, Math.round(pct)));
        }
      }
      return null;
    }

    function determineStatus(progress: number | null, current: number | null): KrProgress['status'] {
      if (current == null) return 'no_data';
      if (progress == null) return 'no_data';
      if (progress >= 70) return 'on_track';
      if (progress >= 40) return 'behind';
      return 'off_track';
    }

    // Group by objective
    const objectiveMap = new Map<string, KrProgress[]>();
    for (const t of targets as OkrTarget[]) {
      const { value, date } = resolveCurrentValue(t);
      const effectiveBaseline = resolveBaseline(t);
      const progress = computeProgress(effectiveBaseline, t.target_value, t.target_direction, value, t.target_min, t.target_max);
      const status = determineStatus(progress, value);

      // Build context string for metrics that need extra info
      let context: string | undefined;
      if (t.key_result === 'hrv_decline_pct' && hrvPrevWeekAvg != null && hrvCurrentWeekAvg != null) {
        context = `Prev week: ${Math.round(hrvPrevWeekAvg)} ms → This week: ${Math.round(hrvCurrentWeekAvg)} ms`;
      }

      const kr: KrProgress = {
        key_result: t.key_result,
        target_value: t.target_value,
        target_direction: t.target_direction,
        unit: t.unit,
        baseline_value: effectiveBaseline,
        current_value: value,
        progress_pct: progress,
        last_updated: date,
        status,
        ...(context ? { context } : {}),
      };

      const existing = objectiveMap.get(t.objective) || [];
      existing.push(kr);
      objectiveMap.set(t.objective, existing);
    }

    const objectives: ObjectiveProgress[] = [];
    for (const [obj, krs] of objectiveMap) {
      const withProgress = krs.filter((kr) => kr.progress_pct != null);
      const overall = withProgress.length > 0
        ? Math.round(withProgress.reduce((sum, kr) => sum + (kr.progress_pct ?? 0), 0) / withProgress.length)
        : null;

      objectives.push({
        objective: obj,
        label: OBJECTIVE_LABELS[obj] || obj,
        key_results: krs,
        overall_pct: overall,
      });
    }

    return NextResponse.json({
      objectives,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('OKR progress error:', err);
    return NextResponse.json(
      { error: 'Failed to compute OKR progress', details: String(err) },
      { status: 500 },
    );
  }
});

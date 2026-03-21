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

    // Fetch last 7 days of Garmin data for averaging daily metrics
    const { data: garminRows } = await supabase
      .from('garmin_daily')
      .select('*')
      .order('date', { ascending: false })
      .limit(7);

    const latestGarmin = garminRows?.[0] ?? null;

    // Metrics that should use 7-day average (daily fluctuating values)
    const AVERAGED_METRICS = ['resting_hr', 'steps', 'sleep_duration_seconds', 'stress_level', 'body_battery', 'hrv_7d_avg'];

    // Compute 7-day averages for daily metrics
    const garmin7dAvg: Record<string, number | null> = {};
    if (garminRows && garminRows.length > 0) {
      for (const col of AVERAGED_METRICS) {
        const values = garminRows
          .map((r) => r[col] as number | null)
          .filter((v): v is number => v != null);
        garmin7dAvg[col] = values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
          : null;
      }
    }

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

    // Resolve current values for each target
    function resolveCurrentValue(t: OkrTarget): { value: number | null; date: string | null } {
      // Weight special case
      if (t.key_result === 'weight' && latestWeight) {
        return { value: Number(latestWeight.weight_kg), date: latestWeight.date };
      }

      // Garmin daily metrics
      if (t.source_table === 'garmin_daily' && latestGarmin && t.source_column) {
        // Use 7-day average for daily fluctuating metrics, latest for stable ones (vo2_max, fitness_age)
        const useAverage = AVERAGED_METRICS.includes(t.source_column);
        let val = useAverage
          ? (garmin7dAvg[t.source_column] ?? null)
          : (latestGarmin[t.source_column] as number | null);
        // Convert sleep_duration_seconds to hours for sleep_hours KR
        if (t.key_result === 'sleep_hours' && val != null) {
          val = Math.round((val / 3600) * 10) / 10;
        }
        return { value: val ?? null, date: latestGarmin.date };
      }

      // Health measurements
      if (t.source_table === 'health_measurements') {
        const m = latestMeasurement[t.key_result];
        return m ? { value: m.value, date: m.date } : { value: null, date: null };
      }

      // Blood work
      if (t.source_table === 'blood_work') {
        const b = latestBlood[t.key_result];
        return b ? { value: b.value, date: b.date } : { value: null, date: null };
      }

      return { value: null, date: null };
    }

    function computeProgress(t: OkrTarget, current: number | null): number | null {
      if (current == null || t.baseline_value == null) return null;
      const baseline = t.baseline_value;
      const target = t.target_value;

      if (t.target_direction === 'lower_is_better') {
        if (baseline === target) return 100;
        const pct = ((baseline - current) / (baseline - target)) * 100;
        return Math.max(0, Math.min(100, Math.round(pct)));
      } else if (t.target_direction === 'higher_is_better') {
        if (baseline === target) return 100;
        const pct = ((current - baseline) / (target - baseline)) * 100;
        return Math.max(0, Math.min(100, Math.round(pct)));
      }
      // range: check if within target_min-target_max
      if (t.target_min != null && t.target_max != null) {
        if (current >= t.target_min && current <= t.target_max) return 100;
        if (current < t.target_min) {
          const pct = ((current - baseline) / (t.target_min - baseline)) * 100;
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
      const progress = computeProgress(t, value);
      const status = determineStatus(progress, value);

      const kr: KrProgress = {
        key_result: t.key_result,
        target_value: t.target_value,
        target_direction: t.target_direction,
        unit: t.unit,
        baseline_value: t.baseline_value,
        current_value: value,
        progress_pct: progress,
        last_updated: date,
        status,
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

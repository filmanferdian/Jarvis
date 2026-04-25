import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const VALID_TYPES = [
  'body_fat',
  'lean_body_mass',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'waist_circumference',
  'dead_hang_seconds',
  'overhead_squat_compensations',
  'run_10k_seconds',
  'max_hr',
];

const DEFAULT_UNITS: Record<string, string> = {
  body_fat: '%',
  lean_body_mass: 'kg',
  blood_pressure_systolic: 'mmHg',
  blood_pressure_diastolic: 'mmHg',
  waist_circumference: 'cm',
  dead_hang_seconds: 'seconds',
  overhead_squat_compensations: 'count',
  run_10k_seconds: 'seconds',
  max_hr: 'bpm',
};

function extractNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, ''));
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    for (const key of ['value', 'quantity', 'Value', 'Quantity', 'number']) {
      if (obj[key] !== undefined) return extractNumber(obj[key]);
    }
    for (const v of Object.values(obj)) {
      const n = extractNumber(v);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return NaN;
}

// POST: Record health measurement (from iOS Shortcuts / Apple Health / manual)
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    console.log('health measurement raw body:', JSON.stringify(body));

    const { measurement_type, date, source, notes } = body as {
      measurement_type?: string;
      date?: string;
      source?: string;
      notes?: string;
    };

    if (!measurement_type || !VALID_TYPES.includes(measurement_type)) {
      return NextResponse.json(
        { error: `measurement_type must be one of: ${VALID_TYPES.join(', ')}`, received: measurement_type },
        { status: 400 },
      );
    }

    let value = extractNumber(body.value);
    if (isNaN(value) || value < 0) {
      // Fallback: scan entire body for a numeric value
      for (const [key, val] of Object.entries(body)) {
        if (['measurement_type', 'date', 'source', 'notes', 'unit'].includes(key)) continue;
        const n = extractNumber(val);
        if (!isNaN(n) && n >= 0) {
          value = n;
          break;
        }
      }
    }

    if (isNaN(value) || value < 0) {
      return NextResponse.json(
        { error: 'value is required and must be a non-negative number', received: body },
        { status: 400 },
      );
    }

    // Use provided date or WIB today
    let dateStr: string;
    if (date) {
      dateStr = date;
    } else {
      const now = new Date();
      const wibOffset = 7 * 60 * 60 * 1000;
      const wibDate = new Date(now.getTime() + wibOffset);
      dateStr = wibDate.toISOString().split('T')[0];
    }

    const unit = (body.unit as string) || DEFAULT_UNITS[measurement_type] || '';
    const src = source || 'apple-health';

    // Delete-then-insert pattern
    await supabase
      .from('health_measurements')
      .delete()
      .eq('date', dateStr)
      .eq('measurement_type', measurement_type)
      .eq('source', src);

    const { error } = await supabase.from('health_measurements').insert({
      date: dateStr,
      measurement_type,
      value,
      unit,
      source: src,
      notes: notes || null,
    });

    if (error) throw error;

    return NextResponse.json({
      saved: true,
      date: dateStr,
      measurement_type,
      value,
      unit,
      source: src,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Health measurement save error:', err);
    return NextResponse.json(
      { error: 'Failed to save measurement' },
      { status: 500 },
    );
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { safeError } from '@/lib/errors';

interface BloodMarker {
  name: string;
  value: number;
  unit: string;
  reference_low?: number;
  reference_high?: number;
}

// POST: Record blood work results (batch)
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { test_date, markers, lab_name, notes } = body as {
      test_date?: string;
      markers?: BloodMarker[];
      lab_name?: string;
      notes?: string;
    };

    if (!test_date) {
      return NextResponse.json({ error: 'test_date is required (YYYY-MM-DD)' }, { status: 400 });
    }

    if (!markers || !Array.isArray(markers) || markers.length === 0) {
      return NextResponse.json({ error: 'markers array is required with at least one marker' }, { status: 400 });
    }

    const results: { name: string; saved: boolean; error?: string }[] = [];

    for (const marker of markers) {
      if (!marker.name || marker.value == null) {
        results.push({ name: marker.name || 'unknown', saved: false, error: 'name and value required' });
        continue;
      }

      // Delete-then-insert
      await supabase
        .from('blood_work')
        .delete()
        .eq('test_date', test_date)
        .eq('marker_name', marker.name);

      const { error } = await supabase.from('blood_work').insert({
        test_date,
        marker_name: marker.name,
        value: marker.value,
        unit: marker.unit || '',
        reference_low: marker.reference_low ?? null,
        reference_high: marker.reference_high ?? null,
        lab_name: lab_name || null,
        notes: notes || null,
      });

      if (error) {
        console.error(`[blood-work] insert failed for marker=${marker.name}:`, error);
      }
      results.push({
        name: marker.name,
        saved: !error,
        error: error ? 'save failed' : undefined,
      });
    }

    return NextResponse.json({
      test_date,
      markers_saved: results.filter((r) => r.saved).length,
      total: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return safeError('Failed to save blood work', err);
  }
});

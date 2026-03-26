import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// POST: Record weight measurement (from iOS Shortcuts / Apple Health)
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { date } = body as { weight_kg?: unknown; date?: string };

    // Extract numeric weight from whatever iOS Shortcuts sends
    console.log('weight request received, keys:', Object.keys(body).join(','));

    function extractNumber(val: unknown): number {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, ''));
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        // Check common property names iOS Shortcuts might use
        for (const key of ['value', 'quantity', 'Value', 'Quantity', 'number']) {
          if (obj[key] !== undefined) return extractNumber(obj[key]);
        }
        // Try first numeric value in the object
        for (const v of Object.values(obj)) {
          const n = extractNumber(v);
          if (!isNaN(n) && n > 0) return n;
        }
      }
      return NaN;
    }

    let weight_kg = extractNumber(body.weight_kg);

    // Fallback: scan entire body for a weight-like number (30-300 kg range)
    if (isNaN(weight_kg) || weight_kg <= 0) {
      for (const [key, val] of Object.entries(body)) {
        if (key === 'date') continue;
        const n = extractNumber(val);
        if (!isNaN(n) && n >= 30 && n <= 300) {
          weight_kg = n;
          break;
        }
      }
    }

    if (!weight_kg || isNaN(weight_kg) || weight_kg <= 0) {
      return NextResponse.json(
        { error: 'weight_kg is required and must be a positive number' },
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

    // Delete existing entry for today, then insert fresh
    await supabase
      .from('weight_log')
      .delete()
      .eq('date', dateStr)
      .eq('source', 'apple-health');

    const { error } = await supabase.from('weight_log').insert({
      date: dateStr,
      weight_kg,
      source: 'apple-health',
    });

    if (error) throw error;

    // Update Health domain KPI for weight
    const { data: healthDomain } = await supabase
      .from('domains')
      .select('id')
      .eq('name', 'Health')
      .single();

    if (healthDomain) {
      const { data: existing } = await supabase
        .from('domain_kpis')
        .select('id')
        .eq('domain_id', healthDomain.id)
        .eq('kpi_name', 'Weight')
        .single();

      const now = new Date().toISOString();
      if (existing) {
        await supabase
          .from('domain_kpis')
          .update({ kpi_value: String(weight_kg), kpi_unit: 'kg', last_updated: now })
          .eq('id', existing.id);
      } else {
        await supabase.from('domain_kpis').insert({
          domain_id: healthDomain.id,
          kpi_name: 'Weight',
          kpi_value: String(weight_kg),
          kpi_target: '87',
          kpi_unit: 'kg',
          last_updated: now,
        });
      }
    }

    return NextResponse.json({
      saved: true,
      date: dateStr,
      weight_kg,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Weight save error:', err);
    return NextResponse.json(
      { error: 'Failed to save weight', details: String(err) },
      { status: 500 },
    );
  }
});

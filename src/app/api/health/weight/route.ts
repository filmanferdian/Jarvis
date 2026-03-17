import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// POST: Record weight measurement (from iOS Shortcuts / Apple Health)
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { weight_kg, date } = body as { weight_kg?: number; date?: string };

    if (!weight_kg || typeof weight_kg !== 'number' || weight_kg <= 0) {
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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Fetch top KPIs with domain info for dashboard display
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Fetch KPIs joined with domain names, ordered by domain display order
    const { data, error } = await supabase
      .from('domain_kpis')
      .select('*, domains(name, display_order)')
      .order('last_updated', { ascending: false });

    if (error) throw error;

    const kpis = (data ?? []).map((kpi) => {
      const domain = kpi.domains as { name: string; display_order: number } | null;
      const progress =
        kpi.kpi_target && kpi.kpi_target > 0
          ? Math.min(100, Math.round((Number(kpi.kpi_value) / Number(kpi.kpi_target)) * 100))
          : null;

      const value = Number(kpi.kpi_value);

      return {
        id: kpi.id,
        domainId: kpi.domain_id,
        domainName: domain?.name ?? 'Unknown',
        displayOrder: domain?.display_order ?? 99,
        name: kpi.kpi_name,
        value,
        target: kpi.kpi_target ? Number(kpi.kpi_target) : null,
        unit: kpi.kpi_unit,
        trend: kpi.trend,
        progress,
        qualifier: (kpi.qualifier as string) ?? null,
        lastUpdated: kpi.last_updated,
      };
    });

    // Sort by domain display order
    kpis.sort((a, b) => a.displayOrder - b.displayOrder);

    return NextResponse.json({ kpis });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch KPIs' },
      { status: 500 }
    );
  }
});

// PATCH: Update a KPI value
export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { id, value } = body;

    if (!id) {
      return NextResponse.json({ error: 'KPI id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { last_updated: new Date().toISOString() };
    if (value !== undefined) updates.kpi_value = value;

    const { data, error } = await supabase
      .from('domain_kpis')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ kpi: data });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update KPI' },
      { status: 500 }
    );
  }
});

// POST: Create a new KPI
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { domainId, name, value, target, unit } = body;

    if (!domainId || !name) {
      return NextResponse.json(
        { error: 'domainId and name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('domain_kpis')
      .insert({
        domain_id: domainId,
        kpi_name: name,
        kpi_value: value ?? 0,
        kpi_target: target ?? null,
        kpi_unit: unit ?? null,
        trend: 'flat',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ kpi: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create KPI' },
      { status: 500 }
    );
  }
});

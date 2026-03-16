import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Fetch all domains with their latest KPI update timestamps
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Fetch domains
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (domainsError) throw domainsError;

    // Fetch the most recent KPI update per domain
    const { data: kpis, error: kpisError } = await supabase
      .from('domain_kpis')
      .select('domain_id, last_updated')
      .order('last_updated', { ascending: false });

    if (kpisError) throw kpisError;

    // Map: domain_id → latest KPI update
    const latestKpiByDomain = new Map<string, string>();
    for (const kpi of kpis ?? []) {
      if (!latestKpiByDomain.has(kpi.domain_id)) {
        latestKpiByDomain.set(kpi.domain_id, kpi.last_updated);
      }
    }

    // Compute health status per domain
    const now = new Date();
    const enriched = (domains ?? []).map((domain) => {
      const lastUpdate = latestKpiByDomain.get(domain.id);
      let healthStatus: 'green' | 'yellow' | 'red' = 'red';
      let daysSinceUpdate: number | null = null;

      if (lastUpdate) {
        const diff = now.getTime() - new Date(lastUpdate).getTime();
        daysSinceUpdate = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (daysSinceUpdate <= Math.floor(domain.alert_threshold_days / 2)) {
          healthStatus = 'green';
        } else if (daysSinceUpdate <= domain.alert_threshold_days) {
          healthStatus = 'yellow';
        } else {
          healthStatus = 'red';
        }
      }

      return {
        id: domain.id,
        name: domain.name,
        displayOrder: domain.display_order,
        alertThresholdDays: domain.alert_threshold_days,
        healthStatus,
        daysSinceUpdate,
        lastUpdated: lastUpdate ?? null,
      };
    });

    return NextResponse.json({ domains: enriched });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
});

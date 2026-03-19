'use client';

import { useEffect, useState } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';

interface InsightsData {
  insights: string;
  cached: boolean;
  date: string;
}

export default function HealthInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchAuth<InsightsData>('/api/health-fitness/insights');
        setData(res);
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5 animate-pulse">
        <div className="h-4 bg-jarvis-border rounded w-40 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-jarvis-border rounded w-full" />
          <div className="h-3 bg-jarvis-border rounded w-5/6" />
          <div className="h-3 bg-jarvis-border rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const lines = data.insights.split('\n').filter((l) => l.trim());

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-jarvis-text-primary">Health Insights</h3>
        <span className="text-[11px] text-jarvis-text-dim">
          {data.cached ? 'Cached' : 'Fresh'} · {data.date}
        </span>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-jarvis-text-secondary leading-relaxed">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

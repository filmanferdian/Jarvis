'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';
import OkrCard from '@/components/health/OkrCard';
import BloodWorkPanel from '@/components/health/BloodWorkPanel';
import ManualEntryForm from '@/components/health/ManualEntryForm';
import HealthInsights from '@/components/health/HealthInsights';

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

interface OkrResponse {
  objectives: ObjectiveProgress[];
}

interface BloodWorkEntry {
  marker_name: string;
  value: number;
  unit: string;
  reference_low: number | null;
  reference_high: number | null;
  test_date: string;
}

interface FitnessContext {
  current_week: number;
  current_phase: string;
}

export default function HealthPage() {
  const [okrData, setOkrData] = useState<OkrResponse | null>(null);
  const [bloodWork, setBloodWork] = useState<BloodWorkEntry[]>([]);
  const [fitnessCtx, setFitnessCtx] = useState<FitnessContext | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [okr, fitness] = await Promise.allSettled([
        fetchAuth<OkrResponse>('/api/health-fitness/okr'),
        fetchAuth<{ context: FitnessContext }>('/api/fitness'),
      ]);

      if (okr.status === 'fulfilled') setOkrData(okr.value);
      if (fitness.status === 'fulfilled') setFitnessCtx(fitness.value.context);

      try {
        const res = await fetch('/api/health-fitness/blood-work', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setBloodWork(data.entries || []);
        }
      } catch {
        // Blood work endpoint may not exist yet
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const overallProgress = okrData
    ? (() => {
        const withData = okrData.objectives.filter((o) => o.overall_pct != null);
        if (withData.length === 0) return null;
        return Math.round(withData.reduce((sum, o) => sum + (o.overall_pct ?? 0), 0) / withData.length);
      })()
    : null;

  const lastBloodDate = bloodWork.length > 0 ? bloodWork[0].test_date : null;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-jarvis-text-muted">
          <a href="/" className="hover:text-jarvis-accent transition-colors">Dashboard</a>
          <span>/</span>
          <span className="text-jarvis-text-primary">Health & Fitness</span>
        </div>

        {/* OKR Overview Bar */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[15px] font-medium text-jarvis-text-primary">OKR Progress</h2>
            {overallProgress != null && (
              <span className="text-lg font-mono font-semibold text-jarvis-accent">{overallProgress}%</span>
            )}
          </div>
          {overallProgress != null && (
            <div className="h-2 bg-jarvis-border rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-jarvis-accent rounded-full transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          )}
          <div className="flex gap-4 text-sm text-jarvis-text-muted">
            {fitnessCtx && (
              <>
                <span>Week {fitnessCtx.current_week} of 52</span>
                <span>{fitnessCtx.current_phase}</span>
              </>
            )}
            <span>Review: Oct 2025 – Oct 2026</span>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-xl border border-jarvis-border bg-jarvis-bg-card animate-pulse" />
            ))}
          </div>
        )}

        {/* OKR Cards */}
        {okrData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {okrData.objectives
              .filter((o) => o.objective !== 'O4')
              .map((obj) => (
                <OkrCard
                  key={obj.objective}
                  objective={obj.objective}
                  label={obj.label}
                  keyResults={obj.key_results}
                  overallPct={obj.overall_pct}
                />
              ))}
          </div>
        )}

        {/* Blood Work Panel (O4) */}
        <BloodWorkPanel entries={bloodWork} lastTestDate={lastBloodDate} />

        {/* AI Health Insights — below O4 */}
        <HealthInsights />

        {/* Manual Entry */}
        <ManualEntryForm onSaved={loadData} />
      </div>
    </AppShell>
  );
}

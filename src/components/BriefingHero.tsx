'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import Mindmap from '@/components/Mindmap';
import BriefingOverlay, { type BriefingData } from '@/components/BriefingOverlay';
import { briefingPreview } from '@/lib/briefingText';

export default function BriefingHero() {
  const { data, loading, refetch } = usePolling<BriefingData>(
    () => fetchAuth('/api/briefing'),
    5 * 60 * 1000
  );
  const [open, setOpen] = useState(false);

  const hasBriefing = !!data?.briefing;
  const estDuration =
    data?.briefing ? Math.max(1, Math.round((data.briefing.split(/\s+/).length || 0) / 150)) : null;
  const preview = hasBriefing ? briefingPreview(data!.briefing!) : '';

  if (loading) {
    return (
      <div className="rounded-[20px] border border-jarvis-ambient-soft bg-gradient-to-br from-white via-[#fafbff] to-[rgba(196,72,138,0.05)] p-7 shadow-[0_24px_64px_-16px_rgba(74,93,207,0.22),0_8px_16px_rgba(12,15,36,0.06)] min-h-[248px] flex items-center">
        <div className="animate-pulse space-y-3 w-full">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-6 bg-jarvis-border rounded w-2/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative rounded-[20px] border border-jarvis-ambient-soft bg-gradient-to-br from-white via-[#fafbff] to-[rgba(196,72,138,0.05)] p-7 shadow-[0_24px_64px_-16px_rgba(74,93,207,0.22),0_8px_16px_rgba(12,15,36,0.06)] overflow-hidden flex gap-6">
        <div
          className="absolute -top-[120px] -right-[120px] w-[400px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(196,72,138,0.15), transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="relative z-[1] w-[180px] flex-shrink-0 hidden md:block">
          <Mindmap size={180} state={hasBriefing ? 'speaking' : 'idle'} className="rounded-2xl" />
        </div>

        <div className="relative z-[1] flex-1 flex flex-col">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="jarvis-live-dot" />
            <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-jarvis-ambient">
              {hasBriefing ? 'Briefing ready' : 'Standing by'}
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[28px] tracking-[-0.02em] leading-[1.1] mb-3 text-jarvis-text-primary">
            {hasBriefing ? 'Morning briefing is ready.' : 'No briefing yet.'}
          </h2>
          <p className="text-[14px] text-jarvis-text-dim m-0 mb-5 max-w-[520px]">
            {hasBriefing ? preview : 'Generate manually or check back after 07:30 WIB.'}
          </p>

          <div className="flex gap-2.5 items-center mt-auto">
            {hasBriefing ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-4.5 py-2.5 rounded-[10px] bg-jarvis-cta text-white text-[13px] font-medium shadow-[0_8px_24px_-8px_rgba(37,99,235,0.4)] hover:bg-jarvis-cta-hover hover:-translate-y-px transition-all duration-[240ms] inline-flex items-center gap-2"
              >
                Begin briefing
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/briefing/regenerate', { method: 'POST', credentials: 'include' });
                  await refetch();
                }}
                className="px-4.5 py-2.5 rounded-[10px] bg-jarvis-cta text-white text-[13px] font-medium shadow-[0_8px_24px_-8px_rgba(37,99,235,0.4)] hover:bg-jarvis-cta-hover hover:-translate-y-px transition-all duration-[240ms] inline-flex items-center gap-2"
              >
                Generate briefing
              </button>
            )}
            {hasBriefing && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-4.5 py-2.5 rounded-[10px] bg-jarvis-bg-card text-jarvis-text-primary border border-jarvis-border-strong text-[13px] font-medium hover:bg-jarvis-bg-deep transition-colors"
              >
                Read transcript
              </button>
            )}
            {estDuration !== null && (
              <span className="ml-auto font-[family-name:var(--font-mono)] text-[11px] text-jarvis-text-faint tracking-[0.1em]">
                ~{estDuration}:00
              </span>
            )}
          </div>
        </div>
      </div>

      <BriefingOverlay open={open} data={data ?? null} onClose={() => setOpen(false)} />
    </>
  );
}

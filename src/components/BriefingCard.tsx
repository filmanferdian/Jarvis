'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import TTSButton from './TTSButton';

interface DeltaItem {
  id: string;
  delta: string;
  audioUrl: string | null;
  hasChanges: boolean;
  timestamp: string;
}

interface BriefingData {
  date: string;
  briefing: string | null;
  voiceover?: string | null;
  audioUrl?: string | null;
  generatedAt?: string;
  message?: string;
  deltas?: DeltaItem[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

export default function BriefingCard() {
  const { data, loading, refetch } = usePolling<BriefingData>(
    () => fetchAuth('/api/briefing'),
    5 * 60 * 1000
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [regenerating, setRegenerating] = useState(false);
  const [deltaLoading, setDeltaLoading] = useState(false);

  const hasBriefing = !!data?.briefing;

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/briefing/regenerate', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await refetch();
      }
    } catch {
      // Silently fail
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelta = async () => {
    setDeltaLoading(true);
    try {
      const res = await fetch('/api/briefing/delta', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await refetch();
      }
    } catch {
      // Silently fail
    } finally {
      setDeltaLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
          <div className="h-3 bg-jarvis-border rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!data?.briefing) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-medium text-jarvis-text-muted">
            Morning Briefing
          </h2>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-sm text-jarvis-accent hover:text-jarvis-accent/80 disabled:opacity-50 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {regenerating ? 'Generating...' : 'Generate now'}
          </button>
        </div>
        <p className="text-base text-jarvis-text-dim">
          {data?.message || 'No briefing available yet. Click "Generate now" or check back after 07:30 WIB.'}
        </p>
      </div>
    );
  }

  const deltas = data.deltas || [];
  const briefingExpanded = expandedSections.has('briefing');

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      {/* Header with update button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-medium text-jarvis-text-primary">
          Morning Briefing
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={hasBriefing ? handleDelta : handleRegenerate}
            disabled={regenerating || deltaLoading}
            className="p-1.5 rounded-lg hover:bg-jarvis-border/50 text-jarvis-text-muted hover:text-jarvis-accent transition-colors disabled:opacity-50"
            title={hasBriefing ? 'Check for updates since morning' : 'Regenerate briefing'}
          >
            <svg
              className={`w-4 h-4 ${regenerating || deltaLoading ? 'animate-spin' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible sections — all at same level */}
      <div className="space-y-2">
        {/* Morning briefing section */}
        <div className="border-l-2 border-jarvis-accent pl-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => toggleSection('briefing')}
              className="flex items-center gap-2 text-left flex-1"
            >
              <svg
                className={`w-3 h-3 text-jarvis-text-muted transition-transform ${briefingExpanded ? 'rotate-90' : ''}`}
                fill="currentColor" viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-base font-medium text-jarvis-text-primary">Briefing</span>
              {data.generatedAt && (
                <span className="text-xs text-jarvis-text-dim">· {formatTime(data.generatedAt)}</span>
              )}
            </button>
            <TTSButton text={data.voiceover || data.briefing} audioUrl={data.audioUrl} />
          </div>
          {briefingExpanded && (
            <div
              className="mt-2 text-base text-jarvis-text-secondary whitespace-pre-line"
              dangerouslySetInnerHTML={{
                __html: data.briefing
                  .replace(/\*\*(.+?)\*\*/g, '<strong class="text-jarvis-text-primary">$1</strong>')
                  .replace(/##\s?(.+)/g, '<span class="text-jarvis-accent font-medium">$1</span>'),
              }}
            />
          )}
        </div>

        {/* Delta update sections — same level as briefing */}
        {deltas.map((delta) => {
          const deltaKey = `delta-${delta.id}`;
          const deltaExpanded = expandedSections.has(deltaKey);
          return (
            <div key={delta.id} className="border-l-2 border-jarvis-warn/60 pl-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleSection(deltaKey)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <svg
                    className={`w-3 h-3 text-jarvis-text-muted transition-transform ${deltaExpanded ? 'rotate-90' : ''}`}
                    fill="currentColor" viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="text-base font-medium text-jarvis-text-primary">Update</span>
                  <span className="text-xs text-jarvis-text-dim">· {formatTime(delta.timestamp)}</span>
                </button>
                <TTSButton text={delta.delta} audioUrl={delta.audioUrl} />
              </div>
              {deltaExpanded && (
                <p className="mt-2 text-base text-jarvis-text-secondary whitespace-pre-line">
                  {delta.delta}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

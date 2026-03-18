'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';
import TTSButton from './TTSButton';

interface BriefingData {
  date: string;
  briefing: string | null;
  voiceover?: string | null;
  generatedAt?: string;
  message?: string;
}

interface BriefingSection {
  title: string;
  content: string;
  isAlert: boolean;
}

function parseBriefing(text: string): BriefingSection[] {
  const sections: BriefingSection[] = [];
  const lines = text.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^\d+\.\s+(.+?):\s*(.*)$/);
    if (headerMatch) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n').trim(),
          isAlert: currentTitle.toLowerCase().includes('alert'),
        });
      }
      currentTitle = headerMatch[1];
      currentContent = headerMatch[2] ? [headerMatch[2]] : [];
    } else if (currentTitle) {
      currentContent.push(line);
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n').trim(),
      isAlert: currentTitle.toLowerCase().includes('alert'),
    });
  }

  if (sections.length === 0 && text.trim()) {
    sections.push({
      title: 'Briefing',
      content: text.trim(),
      isAlert: false,
    });
  }

  return sections;
}

export default function BriefingCard() {
  const { data, loading, refetch } = usePolling<BriefingData>(
    () => fetchAuth('/api/briefing'),
    5 * 60 * 1000
  );

  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );
  const [regenerating, setRegenerating] = useState(false);
  const [activeVoice, setActiveVoice] = useState<'1' | '2'>('1');

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
      // Silently fail — existing briefing stays
    } finally {
      setRegenerating(false);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
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
          <h2 className="text-sm font-medium text-jarvis-text-muted">
            Morning Briefing
          </h2>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-xs text-jarvis-accent hover:text-jarvis-accent/80 disabled:opacity-50 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {regenerating ? 'Generating...' : 'Generate now'}
          </button>
        </div>
        <p className="text-sm text-jarvis-text-dim">
          {data?.message || 'No briefing available yet. Click "Generate now" or check back after 07:30 WIB.'}
        </p>
      </div>
    );
  }

  const sections = parseBriefing(data.briefing);

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-jarvis-accent uppercase tracking-wider">
          Morning Briefing
        </h2>
        <div className="flex items-center gap-2">
          {data.generatedAt && (
            <span className="text-xs text-jarvis-text-dim">
              {new Date(data.generatedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Jakarta',
              })}
            </span>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="p-1.5 rounded-lg hover:bg-jarvis-border/50 text-jarvis-text-muted hover:text-jarvis-accent transition-colors disabled:opacity-50"
            title="Regenerate briefing"
          >
            <svg
              className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={() => setActiveVoice(activeVoice === '1' ? '2' : '1')}
            className="px-2 py-1 rounded text-xs border border-jarvis-border hover:border-jarvis-accent text-jarvis-text-muted transition-colors"
            title={`${activeVoice === '1' ? 'Paul' : 'Morgan'} — click to switch`}
          >
            {activeVoice === '1' ? 'Paul' : 'Morgan'}
          </button>
          <TTSButton text={data.voiceover || data.briefing} voice={activeVoice} />
        </div>
      </div>
      <div className="space-y-3">
        {sections.map((section, i) => {
          const isExpanded = expandedSections.has(i);
          return (
            <div
              key={i}
              className={`border-l-2 pl-4 ${
                section.isAlert
                  ? 'border-jarvis-warn'
                  : 'border-jarvis-accent'
              }`}
            >
              <button
                onClick={() => toggleSection(i)}
                className="flex items-center gap-2 w-full text-left"
              >
                <svg
                  className={`w-3 h-3 text-jarvis-text-muted transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span
                  className={`text-sm font-medium ${
                    section.isAlert
                      ? 'text-jarvis-warn'
                      : 'text-jarvis-text-primary'
                  }`}
                >
                  {section.title}
                </span>
              </button>
              {isExpanded && (
                <div
                  className="mt-2 text-sm text-jarvis-text-secondary whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: section.content
                      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-jarvis-text-primary">$1</strong>')
                      .replace(/##\s?(.+)/g, '<span class="text-jarvis-accent font-medium">$1</span>'),
                  }}
                >
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

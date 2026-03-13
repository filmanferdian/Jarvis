'use client';

import { useEffect, useState } from 'react';
import TTSButton from './TTSButton';

interface BriefingData {
  date: string;
  briefing: string | null;
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
    // Match numbered section headers like "1. Calendar overview:"
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
      // Content before first header
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

  // If no sections were parsed, treat the whole thing as one section
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
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    async function fetchBriefing() {
      try {
        const token = localStorage.getItem('jarvis_token') || '';
        const res = await fetch('/api/briefing', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchBriefing();
  }, []);

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
        <h2 className="text-sm font-medium text-jarvis-text-muted mb-2">
          Morning Briefing
        </h2>
        <p className="text-sm text-jarvis-text-dim">
          {data?.message || 'No briefing available yet. Check back after 07:30 WIB.'}
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
          <TTSButton text={data.briefing} />
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
                <p className="mt-2 text-sm text-jarvis-text-secondary whitespace-pre-line">
                  {section.content}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

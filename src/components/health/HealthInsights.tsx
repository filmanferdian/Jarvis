'use client';

import { useEffect, useState } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';

interface InsightsData {
  insights: string;
  cached: boolean;
  date: string;
}

const SECTION_ICONS: Record<string, string> = {
  "WHAT'S WORKING": '✓',
  'NEEDS ATTENTION': '⚠',
  'FOCUS THIS WEEK': '→',
};

const SECTION_COLORS: Record<string, string> = {
  "WHAT'S WORKING": 'text-jarvis-success',
  'NEEDS ATTENTION': 'text-jarvis-warn',
  'FOCUS THIS WEEK': 'text-jarvis-accent',
};

interface HealthInsightsProps {
  narrative?: string;
}

function renderNarrative(narrative: string) {
  // **text** → ambient-colored accent span (matches §8.3 .hl)
  const parts = narrative.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <span key={i} style={{ color: 'var(--color-jarvis-ambient)' }}>
          {p.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function HealthInsights({ narrative }: HealthInsightsProps = {}) {
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

  // Parse sections from the structured output
  const sections: Array<{ title: string; items: string[] }> = [];
  let currentSection: { title: string; items: string[] } | null = null;

  for (const line of data.insights.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a section header
    const upperLine = trimmed.toUpperCase();
    if (upperLine === "WHAT'S WORKING" || upperLine === 'NEEDS ATTENTION' || upperLine === 'FOCUS THIS WEEK') {
      currentSection = { title: trimmed.toUpperCase(), items: [] };
      sections.push(currentSection);
    } else if (currentSection) {
      // Strip leading "- " bullet marker
      const item = trimmed.startsWith('- ') ? trimmed.slice(2) : trimmed;
      if (item) currentSection.items.push(item);
    }
  }

  // Fallback: if no sections parsed, render as flat list
  const hasSections = sections.length > 0;

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-jarvis-text-primary">Health Insights</h3>
        <span className="text-[11px] text-jarvis-text-dim">
          {data.cached ? 'Cached' : 'Fresh'} · {data.date}
        </span>
      </div>

      {narrative && (
        <p
          className="font-[family-name:var(--font-display)] text-[15px] leading-[1.5] tracking-[-0.005em] mb-4 text-jarvis-text-primary"
        >
          {renderNarrative(narrative)}
        </p>
      )}

      {hasSections ? (
        <div className="space-y-4">
          {sections.map((section) => {
            const icon = SECTION_ICONS[section.title] || '•';
            const color = SECTION_COLORS[section.title] || 'text-jarvis-text-secondary';
            return (
              <div key={section.title}>
                <div className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${color}`}>
                  {icon} {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item, i) => (
                    <p key={i} className="text-sm text-jarvis-text-secondary leading-relaxed pl-4">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.insights.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-sm text-jarvis-text-secondary leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

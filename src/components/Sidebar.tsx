'use client';

import { useEffect, useState } from 'react';

interface Domain {
  id: string;
  name: string;
  displayOrder: number;
  alertThresholdDays: number;
  healthStatus: 'green' | 'yellow' | 'red';
  daysSinceUpdate: number | null;
  lastUpdated: string | null;
}

const HEALTH_COLORS = {
  green: 'bg-emerald-400',
  yellow: 'bg-jarvis-warn',
  red: 'bg-red-400',
};

const HEALTH_RING_COLORS = {
  green: 'ring-emerald-400/30',
  yellow: 'ring-jarvis-warn/30',
  red: 'ring-red-400/30',
};

const FALLBACK_DOMAINS = [
  'Work', 'Wealth', 'Side projects', 'Health', 'Fitness',
  'Spiritual', 'Family', 'Learning', 'Networking', 'Personal branding',
];

export default function Sidebar() {
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDomains() {
      try {
        const token = localStorage.getItem('jarvis_token') || '';
        const res = await fetch('/api/domains', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDomains(data.domains);
        }
      } catch {
        // Fall back to static list
      } finally {
        setLoading(false);
      }
    }
    fetchDomains();
  }, []);

  const redCount = domains?.filter((d) => d.healthStatus === 'red').length ?? 0;
  const yellowCount = domains?.filter((d) => d.healthStatus === 'yellow').length ?? 0;

  return (
    <aside className="w-[280px] border-r border-jarvis-border p-4 hidden md:block overflow-y-auto">
      <h2 className="text-xs uppercase tracking-wider text-jarvis-text-muted mb-4">
        Life Domains
      </h2>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-jarvis-border" />
              <div className="h-3 bg-jarvis-border rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : domains ? (
        <>
          <div className="space-y-1">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jarvis-bg-card transition-colors group"
              >
                <div
                  className={`w-2 h-2 rounded-full ring-2 ${HEALTH_COLORS[domain.healthStatus]} ${HEALTH_RING_COLORS[domain.healthStatus]}`}
                />
                <span className="text-sm text-jarvis-text-secondary flex-1">
                  {domain.name}
                </span>
                {domain.daysSinceUpdate !== null && (
                  <span
                    className={`text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity ${
                      domain.healthStatus === 'red'
                        ? 'text-red-400'
                        : domain.healthStatus === 'yellow'
                          ? 'text-jarvis-warn'
                          : 'text-jarvis-text-dim'
                    }`}
                  >
                    {domain.daysSinceUpdate}d
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Health summary */}
          {(redCount > 0 || yellowCount > 0) && (
            <div className="mt-6 p-3 rounded-lg border border-jarvis-border">
              <p className="text-xs text-jarvis-text-muted mb-2">Attention needed</p>
              <div className="flex gap-3">
                {redCount > 0 && (
                  <span className="text-xs font-mono text-red-400">
                    {redCount} neglected
                  </span>
                )}
                {yellowCount > 0 && (
                  <span className="text-xs font-mono text-jarvis-warn">
                    {yellowCount} aging
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        // Fallback to static list if API fails
        <div className="space-y-2">
          {FALLBACK_DOMAINS.map((domain) => (
            <div
              key={domain}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jarvis-bg-card transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-jarvis-text-dim" />
              <span className="text-sm text-jarvis-text-secondary">{domain}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

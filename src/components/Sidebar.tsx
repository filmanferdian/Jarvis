'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '◉' },
  { href: '/health', label: 'Health & Fitness', icon: '♥' },
  { href: '/utilities', label: 'Utilities', icon: '⚙' },
];

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    async function fetchDomains() {
      try {
        const res = await fetch('/api/domains', { credentials: 'include' });
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

  const total = domains?.length ?? 0;
  const greenCount = domains?.filter((d) => d.healthStatus === 'green').length ?? 0;
  const yellowCount = domains?.filter((d) => d.healthStatus === 'yellow').length ?? 0;
  const redCount = domains?.filter((d) => d.healthStatus === 'red').length ?? 0;

  // Compute conic gradient for donut chart
  const healthScore = total > 0 ? Math.round((greenCount / total) * 100) : 0;
  const greenPct = total > 0 ? (greenCount / total) * 100 : 0;
  const yellowPct = total > 0 ? (yellowCount / total) * 100 : 0;
  const redPct = total > 0 ? (redCount / total) * 100 : 0;

  return (
    <aside
      className={`w-[280px] border-r border-jarvis-border p-4 overflow-y-auto bg-jarvis-bg transition-transform duration-200 ${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-50 translate-x-0'
          : 'hidden md:block'
      }`}
    >
      {/* Navigation */}
      <nav className="mb-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-jarvis-accent/10 text-jarvis-accent font-medium'
                  : 'text-jarvis-text-secondary hover:bg-jarvis-bg-card'
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-wider text-jarvis-text-muted">
          Life Domains
        </h2>
        {mobileOpen && (
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded hover:bg-jarvis-bg-card text-jarvis-text-muted"
            aria-label="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Health Ring Donut */}
      {domains && total > 0 && (
        <div className="flex flex-col items-center mb-5">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
              {/* Background ring */}
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke="rgba(0,180,216,0.08)"
                strokeWidth="4"
              />
              {/* Green segment */}
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke="#34d399"
                strokeWidth="4"
                strokeDasharray={`${greenPct * 0.88} ${88 - greenPct * 0.88}`}
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Yellow segment */}
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke="#ef9f27"
                strokeWidth="4"
                strokeDasharray={`${yellowPct * 0.88} ${88 - yellowPct * 0.88}`}
                strokeDashoffset={`${-(greenPct * 0.88)}`}
                strokeLinecap="round"
              />
              {/* Red segment */}
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke="#f87171"
                strokeWidth="4"
                strokeDasharray={`${redPct * 0.88} ${88 - redPct * 0.88}`}
                strokeDashoffset={`${-((greenPct + yellowPct) * 0.88)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold text-jarvis-text-primary font-mono">
                {healthScore}%
              </span>
              <span className="text-[9px] text-jarvis-text-dim uppercase tracking-wider">
                healthy
              </span>
            </div>
          </div>
          <div className="flex gap-3 mt-2 text-[10px] text-jarvis-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {greenCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-jarvis-warn" />
              {yellowCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {redCount}
            </span>
          </div>
        </div>
      )}

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

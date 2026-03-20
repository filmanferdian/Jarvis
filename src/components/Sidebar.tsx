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
  green: 'bg-jarvis-success',
  yellow: 'bg-jarvis-warn',
  red: 'bg-jarvis-danger',
};

const HEALTH_TEXT = {
  green: 'text-jarvis-success',
  yellow: 'text-jarvis-warn',
  red: 'text-jarvis-danger',
};

const FALLBACK_DOMAINS = [
  'Work', 'Wealth', 'Side projects', 'Health', 'Fitness',
  'Spiritual', 'Family', 'Learning', 'Networking', 'Personal branding',
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/health',
    label: 'Health & Fitness',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    href: '/utilities',
    label: 'Utilities',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
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

  const healthScore = total > 0 ? Math.round((greenCount / total) * 100) : 0;
  const greenPct = total > 0 ? (greenCount / total) * 100 : 0;
  const yellowPct = total > 0 ? (yellowCount / total) * 100 : 0;
  const redPct = total > 0 ? (redCount / total) * 100 : 0;

  return (
    <aside
      className={`w-[260px] border-r border-jarvis-border bg-jarvis-bg overflow-y-auto transition-transform duration-200 ${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-50 translate-x-0'
          : 'hidden md:block'
      }`}
    >
      <div className="p-4 space-y-6">
        {/* Navigation */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  isActive
                    ? 'bg-jarvis-accent-muted text-jarvis-text-primary font-medium'
                    : 'text-jarvis-text-muted hover:text-jarvis-text-secondary hover:bg-jarvis-bg-hover'
                }`}
              >
                {/* Active indicator — blue left bar */}
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-jarvis-accent" />
                )}
                <span className={`flex items-center ${isActive ? 'text-jarvis-accent' : ''}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="h-px bg-jarvis-border" />

        {/* Life Domains header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-jarvis-text-dim">
            Life Domains
          </h2>
          {mobileOpen && (
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-lg hover:bg-jarvis-bg-hover text-jarvis-text-dim"
              aria-label="Close sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Health Ring Donut */}
        {domains && total > 0 && (
          <div className="flex flex-col items-center">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="3.5"
                  strokeDasharray={`${greenPct * 0.88} ${88 - greenPct * 0.88}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  strokeDasharray={`${yellowPct * 0.88} ${88 - yellowPct * 0.88}`}
                  strokeDashoffset={`${-(greenPct * 0.88)}`}
                  strokeLinecap="round"
                />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="3.5"
                  strokeDasharray={`${redPct * 0.88} ${88 - redPct * 0.88}`}
                  strokeDashoffset={`${-((greenPct + yellowPct) * 0.88)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-semibold text-jarvis-text-primary font-mono">
                  {healthScore}%
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-jarvis-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis-success" />
                {greenCount}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis-warn" />
                {yellowCount}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis-danger" />
                {redCount}
              </span>
            </div>
          </div>
        )}

        {/* Domain list */}
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-jarvis-border animate-shimmer" />
                <div className="h-3 bg-jarvis-border rounded w-3/4 animate-shimmer" />
              </div>
            ))}
          </div>
        ) : domains ? (
          <>
            <div className="space-y-0.5">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-jarvis-bg-hover transition-colors group"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${HEALTH_COLORS[domain.healthStatus]}`} />
                  <span className="text-[13px] text-jarvis-text-muted flex-1 group-hover:text-jarvis-text-secondary transition-colors">
                    {domain.name}
                  </span>
                  {domain.daysSinceUpdate !== null && (
                    <span
                      className={`text-[11px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${
                        HEALTH_TEXT[domain.healthStatus]
                      }`}
                    >
                      {domain.daysSinceUpdate}d
                    </span>
                  )}
                </div>
              ))}
            </div>

            {(redCount > 0 || yellowCount > 0) && (
              <div className="px-3 py-2.5 rounded-lg bg-jarvis-bg-elevated border border-jarvis-border">
                <p className="text-[11px] text-jarvis-text-dim mb-1.5 font-medium">Needs attention</p>
                <div className="flex gap-3">
                  {redCount > 0 && (
                    <span className="text-[11px] font-mono text-jarvis-danger">
                      {redCount} neglected
                    </span>
                  )}
                  {yellowCount > 0 && (
                    <span className="text-[11px] font-mono text-jarvis-warn">
                      {yellowCount} aging
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-0.5">
            {FALLBACK_DOMAINS.map((domain) => (
              <div
                key={domain}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-jarvis-bg-hover transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-jarvis-text-dim" />
                <span className="text-[13px] text-jarvis-text-muted">{domain}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

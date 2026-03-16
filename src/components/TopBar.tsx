'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  callCount: number;
  limit: number;
  remaining: number;
  date: string;
}

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch {
        // Silently fail - non-critical
      }
    }
    fetchUsage();
    const interval = setInterval(fetchUsage, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jarvis_token');
    window.location.reload();
  };

  const usagePercent = usage ? (usage.callCount / usage.limit) * 100 : 0;
  const isWarning = usagePercent >= 80;

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-jarvis-border">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-1 rounded hover:bg-jarvis-bg-card transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5 text-jarvis-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold tracking-wide text-jarvis-accent">
          JARVIS
        </h1>
        <span className="text-xs text-jarvis-text-muted hidden sm:inline">
          Personal Command Center
        </span>
      </div>
      <div className="flex items-center gap-4">
        {usage && (
          <span
            className={`text-xs font-mono ${
              isWarning ? 'text-jarvis-warn' : 'text-jarvis-text-secondary'
            }`}
          >
            {usage.callCount}/{usage.limit}
          </span>
        )}
        <div className="w-2 h-2 rounded-full bg-jarvis-accent animate-pulse" />
        <button
          onClick={handleLogout}
          className="text-xs text-jarvis-text-dim hover:text-jarvis-text-secondary transition-colors"
          title="Logout"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { VERSION } from '@/lib/version';
import ArcReactor from '@/components/ArcReactor';

interface UsageData {
  callCount: number;
  limit: number;
  remaining: number;
  date: string;
}

interface TopBarProps {
  onToggleSidebar?: () => void;
}

function useWibClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    function tick() {
      setNow(new Date());
    }
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return { time: '', date: '' };

  const wibOffset = 7 * 60 * 60 * 1000;
  const wib = new Date(now.getTime() + wibOffset);
  const hh = String(wib.getUTCHours()).padStart(2, '0');
  const mm = String(wib.getUTCMinutes()).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[wib.getUTCDay()];
  const day = wib.getUTCDate();
  const month = months[wib.getUTCMonth()];
  const year = wib.getUTCFullYear();

  return {
    time: `${hh}:${mm}`,
    date: `${dayName}, ${day} ${month} ${year}`,
  };
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const clock = useWibClock();

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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.reload();
  };

  const usagePercent = usage ? (usage.callCount / usage.limit) * 100 : 0;
  const isWarning = usagePercent >= 80;

  return (
    <header className="flex items-center justify-between px-5 md:px-6 h-14 border-b border-jarvis-border bg-jarvis-bg/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-jarvis-bg-hover transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5 text-jarvis-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Arc Reactor icon + JARVIS wordmark */}
        <ArcReactor state="idle" size="sm" />
        <span className="text-[15px] font-semibold text-jarvis-text-primary tracking-widest">
          JARVIS
        </span>
        <span className="text-[10px] text-jarvis-text-dim font-mono">
          v{VERSION.string}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {clock.time && (
          <div className="flex items-center gap-1.5 text-xs text-jarvis-text-muted">
            <span className="hidden sm:inline">{clock.date}</span>
            <span className="hidden sm:inline text-jarvis-text-dim">·</span>
            <span className="font-mono text-jarvis-text-secondary">{clock.time}</span>
          </div>
        )}

        {usage && (
          <span
            className={`text-xs font-mono ${
              isWarning ? 'text-jarvis-warn' : 'text-jarvis-text-dim'
            }`}
          >
            {usage.callCount}/{usage.limit}
          </span>
        )}

        {/* Neon green ONLINE status pill */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[rgba(57,255,20,0.25)] bg-[rgba(57,255,20,0.06)]">
          <div className="relative">
            <div className="w-1.5 h-1.5 rounded-full bg-jarvis-neon" />
            <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-jarvis-neon animate-ping-slow" />
          </div>
          <span className="text-[10px] font-medium text-jarvis-neon tracking-wide hidden sm:inline">
            ONLINE
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg text-jarvis-text-dim hover:text-jarvis-text-secondary hover:bg-jarvis-bg-hover transition-colors"
          title="Logout"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}

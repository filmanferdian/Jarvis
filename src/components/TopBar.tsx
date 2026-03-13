'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  callCount: number;
  limit: number;
  remaining: number;
  date: string;
}

export default function TopBar() {
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

  const usagePercent = usage ? (usage.callCount / usage.limit) * 100 : 0;
  const isWarning = usagePercent >= 80;

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-jarvis-border">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-wide text-jarvis-accent">
          JARVIS
        </h1>
        <span className="text-xs text-jarvis-text-muted">
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
      </div>
    </header>
  );
}

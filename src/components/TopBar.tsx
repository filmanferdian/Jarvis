'use client';

import { useEffect, useState } from 'react';
import Mindmap from '@/components/Mindmap';
import { VERSION } from '@/lib/version';

function useWibClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    function tick() { setNow(new Date()); }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return { greeting: '', dateTime: '' };

  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const hh = wib.getUTCHours();
  const mm = String(wib.getUTCMinutes()).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[wib.getUTCDay()];
  const day = wib.getUTCDate();
  const month = months[wib.getUTCMonth()];
  const greet = hh < 12 ? 'Good morning' : hh < 18 ? 'Good afternoon' : 'Good evening';

  return {
    greeting: `${greet}, Filman.`,
    dateTime: `${dayName}, ${day} ${month} · ${String(hh).padStart(2, '0')}:${mm} WIB`,
  };
}

type TopBarProps = {
  onOpenPalette?: (options?: { voice?: boolean }) => void;
};

export default function TopBar({ onOpenPalette }: TopBarProps) {
  const clock = useWibClock();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.reload();
  };

  return (
    <header className="flex items-center gap-5 px-7 min-h-[64px] border-b border-jarvis-border bg-jarvis-bg-card flex-shrink-0">
      <div className="flex items-center gap-3">
        <Mindmap size={36} state="idle" className="rounded-lg" />
        <div className="font-[family-name:var(--font-display)] text-[15px] font-medium tracking-[-0.01em] text-jarvis-text-primary">
          {clock.greeting}{' '}
          <span className="text-jarvis-text-dim font-normal">{clock.dateTime}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-jarvis-bg-deep font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] text-jarvis-text-dim">
          v{VERSION.string}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onOpenPalette?.()}
        className="flex items-center gap-2.5 flex-1 max-w-[420px] ml-auto px-3.5 py-2 bg-jarvis-bg-deep border border-transparent hover:border-jarvis-border-strong rounded-[10px] text-[13px] text-jarvis-text-faint hover:text-jarvis-text-dim transition-colors"
        aria-label="Open command palette"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M16 16l4 4" />
        </svg>
        <span>Ask, command, search…</span>
        <span className="ml-auto px-1.5 py-[1px] rounded bg-jarvis-bg-card border border-jarvis-border font-[family-name:var(--font-mono)] text-[10px] text-jarvis-text-faint">
          ⌘K
        </span>
      </button>

      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-jarvis-text-primary text-white font-[family-name:var(--font-mono)] text-[10px] tracking-[0.15em] uppercase">
        <span className="jarvis-live-dot" />
        <span className="hidden sm:inline">Online</span>
      </div>

      <button
        type="button"
        onClick={() => onOpenPalette?.({ voice: true })}
        className="w-10 h-10 rounded-[11px] bg-jarvis-ambient-soft text-jarvis-ambient hover:bg-jarvis-ambient hover:text-white transition-all duration-[240ms] flex items-center justify-center hover:-translate-y-px"
        aria-label="Voice command"
        title="Voice command"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="p-1.5 rounded-lg text-jarvis-text-faint hover:text-jarvis-text-dim hover:bg-jarvis-bg-deep transition-colors"
        title="Logout"
        aria-label="Logout"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </header>
  );
}

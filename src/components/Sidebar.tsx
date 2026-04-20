'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l9-8 9 8" />
        <path d="M5 10v9h14v-9" />
      </svg>
    ),
  },
  {
    href: '/briefing',
    label: 'Briefing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    ),
  },
  {
    href: '/health',
    label: 'Health & Fitness',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4l2-5 3 10 2-5h7" />
      </svg>
    ),
  },
  {
    href: '/cardio-analysis',
    label: 'Cardio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
      </svg>
    ),
  },
  {
    href: '/emails',
    label: 'Email',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ),
  },
  {
    href: '/contacts',
    label: 'Contacts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="3" />
        <path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 3a3 3 0 0 1 0 6M21 20c0-2.5-1.8-4.5-4-5" />
      </svg>
    ),
  },
  {
    href: '/utilities',
    label: 'Utilities',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
      </svg>
    ),
  },
];

const PIN_KEY = 'jarvis.sidebar.pinned';

export default function Sidebar() {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === '1');
    } catch {
      // no-op
    }
  }, []);

  const togglePin = () => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PIN_KEY, next ? '1' : '0');
      } catch {
        // no-op
      }
      return next;
    });
  };

  return (
    <aside
      className={`group/sidebar relative flex flex-col gap-2 overflow-hidden border-r border-jarvis-border bg-jarvis-bg-card px-3.5 py-5 transition-[width] duration-400 ease-[cubic-bezier(.25,.46,.45,.94)] z-10 ${
        pinned ? 'w-[240px]' : 'w-[72px] hover:w-[240px]'
      }`}
      aria-expanded={pinned}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-1 mb-5 min-w-[200px]">
        <div className="relative w-10 h-10 rounded-[11px] flex-shrink-0 overflow-hidden"
             style={{ background: 'radial-gradient(circle at 35% 30%, #a6b4ff, #4a5dcf 70%, #2a3580)' }}>
          <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <g fill="#fff" opacity="0.95">
              <circle cx="14" cy="12" r="1.8" />
              <circle cx="26" cy="14" r="1.2" />
              <circle cx="30" cy="24" r="1.6" />
              <circle cx="10" cy="22" r="1" />
              <circle cx="18" cy="28" r="1.4" />
              <circle cx="28" cy="30" r="1" />
              <circle cx="20" cy="20" r="0.9" />
            </g>
            <g stroke="rgba(255,255,255,0.4)" strokeWidth="0.5">
              <line x1="14" y1="12" x2="20" y2="20" />
              <line x1="26" y1="14" x2="20" y2="20" />
              <line x1="30" y1="24" x2="20" y2="20" />
              <line x1="18" y1="28" x2="20" y2="20" />
              <line x1="10" y1="22" x2="18" y2="28" />
            </g>
          </svg>
        </div>
        <span
          className={`font-[family-name:var(--font-display)] font-semibold text-[18px] tracking-[-0.02em] text-jarvis-text-primary transition-opacity duration-300 ${
            pinned ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'
          }`}
        >
          JARVIS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 px-2.5 py-2.5 rounded-[10px] text-[13.5px] font-medium whitespace-nowrap overflow-hidden transition-colors duration-150 ${
                isActive
                  ? 'bg-jarvis-cta-soft text-jarvis-cta'
                  : 'text-jarvis-text-dim hover:bg-jarvis-bg-deep hover:text-jarvis-text-primary'
              }`}
            >
              <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
              <span
                className={`min-w-[160px] transition-opacity duration-300 ${
                  pinned ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Pin toggle */}
      <button
        type="button"
        onClick={togglePin}
        className="mt-auto flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-jarvis-text-faint hover:text-jarvis-text-dim whitespace-nowrap"
        aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5z M12 14v6" />
        </svg>
        <span
          className={`transition-opacity duration-300 ${
            pinned ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'
          }`}
        >
          {pinned ? 'Unpin sidebar' : 'Pin sidebar'}
        </span>
      </button>
    </aside>
  );
}

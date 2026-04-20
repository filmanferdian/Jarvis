'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Command = {
  id: string;
  group: 'Actions' | 'Jump to' | 'Suggestions';
  label: string;
  kbd?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  initialVoice?: boolean;
  onClose: () => void;
  onStartBriefing?: () => void;
};

export default function CommandPalette({ open, initialVoice, onClose, onStartBriefing }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const commands: Command[] = useMemo(
    () => [
      {
        id: 'play-briefing',
        group: 'Actions',
        label: 'Play morning briefing',
        kbd: '↵',
        run: () => { onStartBriefing?.(); onClose(); },
      },
      {
        id: 'goto-dashboard',
        group: 'Jump to',
        label: 'Dashboard',
        run: () => { router.push('/'); onClose(); },
      },
      {
        id: 'goto-briefing',
        group: 'Jump to',
        label: 'Briefing',
        run: () => { router.push('/briefing'); onClose(); },
      },
      {
        id: 'goto-health',
        group: 'Jump to',
        label: 'Health & Fitness',
        run: () => { router.push('/health'); onClose(); },
      },
      {
        id: 'goto-cardio',
        group: 'Jump to',
        label: 'Cardio',
        run: () => { router.push('/cardio-analysis'); onClose(); },
      },
      {
        id: 'goto-emails',
        group: 'Jump to',
        label: 'Email Triage',
        run: () => { router.push('/emails'); onClose(); },
      },
      {
        id: 'goto-contacts',
        group: 'Jump to',
        label: 'Contacts',
        run: () => { router.push('/contacts'); onClose(); },
      },
      {
        id: 'goto-utilities',
        group: 'Jump to',
        label: 'Utilities',
        run: () => { router.push('/utilities'); onClose(); },
      },
      {
        id: 'regenerate-briefing',
        group: 'Suggestions',
        label: 'Generate a fresh briefing',
        kbd: 'G',
        run: async () => {
          onClose();
          await fetch('/api/briefing/regenerate', { method: 'POST', credentials: 'include' });
        },
      },
    ],
    [router, onClose, onStartBriefing]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      stopListening();
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (open && initialVoice) startListening();
  }, [open, initialVoice]);

  const startListening = () => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (event: SpeechResultEvent) => {
      const transcript = event.results.item(0).item(0).transcript;
      setQuery(transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      filtered[activeIdx]?.run();
    }
  };

  if (!open) return null;

  const groups = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});

  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] bg-[rgba(12,15,36,0.22)] backdrop-blur-lg animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-[min(640px,92vw)] bg-jarvis-bg-card border border-jarvis-border-strong rounded-2xl shadow-[0_32px_80px_-16px_rgba(12,15,36,0.2)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-jarvis-border">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-jarvis-text-faint)" strokeWidth={1.6} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M16 16l4 4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask, command, or search…"
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-jarvis-text-primary placeholder:text-jarvis-text-faint"
          />
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              listening
                ? 'bg-jarvis-ambient text-white'
                : 'bg-jarvis-ambient-soft text-jarvis-ambient hover:bg-jarvis-ambient hover:text-white'
            }`}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName} className="py-1.5">
              <div className="px-4 py-1.5 font-[family-name:var(--font-mono)] text-[9.5px] tracking-[0.2em] uppercase text-jarvis-text-faint">
                {groupName}
              </div>
              {items.map((c) => {
                runningIdx += 1;
                const active = runningIdx === activeIdx;
                const myIdx = runningIdx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseEnter={() => setActiveIdx(myIdx)}
                    onClick={c.run}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-[13.5px] text-left transition-colors ${
                      active ? 'bg-jarvis-cta-soft text-jarvis-cta' : 'text-jarvis-text-primary hover:bg-jarvis-bg-deep'
                    }`}
                  >
                    <span className="flex-1">{c.label}</span>
                    {c.kbd && (
                      <span className="font-[family-name:var(--font-mono)] text-[10px] px-1.5 py-0.5 rounded bg-jarvis-bg-deep text-jarvis-text-dim">
                        {c.kbd}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-jarvis-text-faint">
              No commands match “{query}”.
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-jarvis-border flex justify-between font-[family-name:var(--font-mono)] text-[10px] text-jarvis-text-faint">
          <span>↑↓ navigate · ↵ run · esc close</span>
          <span>hold mic to speak</span>
        </div>
      </div>
    </div>
  );
}

type SpeechResultEvent = {
  results: { item: (i: number) => { item: (i: number) => { transcript: string } } };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

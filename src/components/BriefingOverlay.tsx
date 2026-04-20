'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Mindmap from '@/components/Mindmap';
import { useSpeaking } from '@/contexts/SpeakingContext';

export type BriefingData = {
  date: string;
  briefing: string | null;
  voiceover?: string | null;
  audioUrl?: string | null;
  generatedAt?: string;
  message?: string;
};

type Props = {
  open: boolean;
  data: BriefingData | null;
  onClose: () => void;
};

function splitLines(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BriefingOverlay({ open, data, onClose }: Props) {
  const { setSpeaking, registerStopFn } = useSpeaking();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const lines = useMemo(
    () => splitLines(data?.voiceover ?? data?.briefing ?? ''),
    [data?.voiceover, data?.briefing]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
    setSpeaking(false);
  };

  const play = async () => {
    if (!data) return;

    // Prefer the pre-rendered audio when available
    if (data.audioUrl) {
      const audio = audioRef.current ?? new Audio(data.audioUrl);
      audioRef.current = audio;
      audio.src = data.audioUrl;
      audio.onloadedmetadata = () => setDuration(audio.duration || 0);
      audio.ontimeupdate = () => {
        setProgress(audio.currentTime || 0);
        if (audio.duration && lines.length > 0) {
          const frac = audio.currentTime / audio.duration;
          setLineIdx(Math.min(lines.length - 1, Math.floor(frac * lines.length)));
        }
      };
      audio.onended = () => { setPlaying(false); setSpeaking(false); };
      registerStopFn(stop);
      await audio.play();
      setPlaying(true);
      setSpeaking(true);
      return;
    }

    // Fallback: synthesize via API
    const text = data.voiceover || data.briefing;
    if (!text) return;
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration || 0);
    audio.ontimeupdate = () => {
      setProgress(audio.currentTime || 0);
      if (audio.duration && lines.length > 0) {
        const frac = audio.currentTime / audio.duration;
        setLineIdx(Math.min(lines.length - 1, Math.floor(frac * lines.length)));
      }
    };
    audio.onended = () => { setPlaying(false); setSpeaking(false); URL.revokeObjectURL(url); };
    registerStopFn(stop);
    await audio.play();
    setPlaying(true);
    setSpeaking(true);
  };

  const jumpToLine = (idx: number) => {
    setLineIdx(idx);
    if (audioRef.current && duration > 0 && lines.length > 0) {
      audioRef.current.currentTime = (idx / lines.length) * duration;
    }
  };

  if (!open) return null;

  const current = lines[lineIdx] ?? '';
  const past = lines.slice(Math.max(0, lineIdx - 2), lineIdx);
  const upcoming = lines.slice(lineIdx + 1, lineIdx + 3);
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto flex flex-col animate-fade-in"
      style={{ background: 'radial-gradient(circle at 50% 45%, #fafbff, #ecedf5)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Briefing playback"
    >
      <button
        type="button"
        onClick={() => { stop(); onClose(); }}
        className="absolute top-6 right-6 w-10 h-10 rounded-[10px] bg-jarvis-bg-card border border-jarvis-border flex items-center justify-center z-[2] hover:bg-jarvis-bg-deep"
        aria-label="Close briefing"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>

      <div className="px-8 py-16 flex flex-col items-center gap-7 min-h-full">
        <div className="w-[min(560px,90vw)] aspect-square relative">
          <Mindmap
            size={560}
            state={playing ? 'speaking' : 'idle'}
            density="dense"
            className="rounded-3xl w-full h-full"
          />
        </div>

        <div className="w-full max-w-[720px] text-center px-5 py-4">
          {past.map((line, i) => (
            <p key={`p-${i}`} className="font-[family-name:var(--font-display)] text-[14px] my-2 text-jarvis-text-faint">
              {line}
            </p>
          ))}
          <p className="font-[family-name:var(--font-display)] text-[22px] font-medium my-3 leading-[1.35] tracking-[-0.01em] text-jarvis-text-primary">
            {current || '—'}
          </p>
          {upcoming.map((line, i) => (
            <p key={`u-${i}`} className="font-[family-name:var(--font-display)] text-[14px] my-2 text-jarvis-text-dim">
              {line}
            </p>
          ))}
        </div>

        <div className="w-full max-w-[720px] flex items-center gap-4 px-5 py-3.5 bg-jarvis-bg-card border border-jarvis-border rounded-2xl">
          <button
            type="button"
            onClick={playing ? stop : play}
            className="w-11 h-11 rounded-full bg-jarvis-cta text-white flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(37,99,235,0.4)] hover:bg-jarvis-cta-hover transition-colors"
            aria-label={playing ? 'Pause briefing' : 'Play briefing'}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="flex-1 h-1 bg-jarvis-track rounded-full relative">
            <div
              className="h-full bg-jarvis-ambient rounded-full transition-[width] duration-150"
              style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-jarvis-text-dim">
            {fmt(progress)} / {fmt(duration)}
          </span>
        </div>

        {lines.length > 0 && (
          <div className="w-full max-w-[720px] flex flex-col gap-1">
            {lines.map((line, i) => (
              <button
                key={`c-${i}`}
                type="button"
                onClick={() => jumpToLine(i)}
                className={`grid grid-cols-[48px_1fr_auto] gap-2.5 items-center px-3 py-2.5 rounded-[10px] text-[13px] text-left transition-colors ${
                  i === lineIdx
                    ? 'bg-jarvis-ambient-soft text-jarvis-ambient'
                    : 'text-jarvis-text-dim hover:bg-jarvis-bg-deep'
                }`}
              >
                <span className={`font-[family-name:var(--font-mono)] text-[11px] ${i === lineIdx ? 'text-jarvis-ambient' : 'text-jarvis-text-faint'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="truncate">{line}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

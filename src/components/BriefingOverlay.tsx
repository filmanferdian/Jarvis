'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'error';

export default function BriefingOverlay({ open, data, onClose }: Props) {
  const { setSpeaking, registerStopFn } = useSpeaking();
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linesRef = useRef<string[]>([]);

  const lines = useMemo(
    () => splitLines(data?.voiceover ?? data?.briefing ?? ''),
    [data?.voiceover, data?.briefing]
  );
  linesRef.current = lines;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
        audioRef.current = null;
      }
    } catch {
      // Ignore Mobile Safari quirks
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    setStatus('idle');
    setSpeaking(false);
  }, [setSpeaking]);

  useEffect(() => {
    registerStopFn(stop);
  }, [registerStopFn, stop]);

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
      stop();
    };
  }, [stop]);

  const fallbackToWebSpeech = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatus('error');
      setErrorMsg('Audio playback unavailable in this browser.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => { setStatus('idle'); setSpeaking(false); };
    utterance.onerror = () => { setStatus('idle'); setSpeaking(false); };
    window.speechSynthesis.speak(utterance);
    setStatus('playing');
    setSpeaking(true);
  };

  const playAudioBlob = async (blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio();
    audio.setAttribute('playsinline', 'true');
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.ontimeupdate = () => {
      const cur = audio.currentTime || 0;
      setProgress(cur);
      const dur = audio.duration;
      const ls = linesRef.current;
      if (Number.isFinite(dur) && dur > 0 && ls.length > 0) {
        setLineIdx(Math.min(ls.length - 1, Math.floor((cur / dur) * ls.length)));
      }
    };
    audio.onended = () => { setStatus('idle'); setSpeaking(false); };

    audio.src = url;

    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error('Audio load failed'));
      setTimeout(resolve, 5000);
    });

    await audio.play();
    setStatus('playing');
    setSpeaking(true);
  };

  const playStoredAudio = async (url: string, controller: AbortController) => {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Stored audio fetch failed: ${res.status}`);
    const blob = await res.blob();
    await playAudioBlob(blob);
  };

  const playStreaming = async (text: string, controller: AbortController) => {
    const res = await fetch('/api/tts?stream=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
    if (!res.body) throw new Error('No response body for streaming');
    const reader = res.body.getReader();
    const chunks: ArrayBuffer[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value.buffer as ArrayBuffer);
    }
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    await playAudioBlob(blob);
  };

  const playBlob = async (text: string, controller: AbortController) => {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
    const blob = await res.blob();
    await playAudioBlob(blob);
  };

  const play = async () => {
    if (!data) return;
    const text = data.voiceover || data.briefing;
    if (!text) return;

    setStatus('loading');
    setErrorMsg(null);
    const controller = new AbortController();
    abortRef.current = controller;

    timeoutRef.current = setTimeout(() => {
      if (abortRef.current === controller) {
        controller.abort();
        fallbackToWebSpeech(text);
      }
    }, 20000);

    try {
      if (data.audioUrl) {
        try {
          await playStoredAudio(data.audioUrl, controller);
          return;
        } catch (storedErr) {
          if (controller.signal.aborted) return;
          console.warn('[Briefing] Stored audio failed, falling back to live TTS:', storedErr);
        }
      }

      if (isIOS()) {
        await playBlob(text, controller);
      } else {
        await playStreaming(text, controller);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[Briefing] TTS failed, falling back to Web Speech:', err);
      fallbackToWebSpeech(text);
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
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
    if (!Number.isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';

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
            state={isPlaying ? 'speaking' : isLoading ? 'thinking' : 'idle'}
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
            onClick={isPlaying || isLoading ? stop : play}
            disabled={!data?.briefing}
            className="w-11 h-11 rounded-full bg-jarvis-cta text-white flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(37,99,235,0.4)] hover:bg-jarvis-cta-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={
              isLoading ? 'Loading briefing audio' : isPlaying ? 'Pause briefing' : 'Play briefing'
            }
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isPlaying ? (
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

        {status === 'error' && errorMsg && (
          <div className="max-w-[720px] text-[12px] text-jarvis-danger font-[family-name:var(--font-mono)]">
            {errorMsg}
          </div>
        )}

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

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

// Strip common markdown markers before we render prose or feed it to splitLines.
// Keeps the sentence text intact; drops heading-only and list-marker-only lines.
function sanitizeForSpeech(text: string): string {
  return text
    .split('\n')
    .map((line) => line
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
      .replace(/\*([^*]+)\*/g, '$1') // italic
      .replace(/^#{1,6}\s+/, '') // heading prefix
      .replace(/^\s*[-•]\s+/, '') // bullet marker
      .replace(/^\s*\d+\.\s+/, '') // numbered marker
      .trim())
    .filter((line) => line.length > 0)
    // Drop lines that are effectively just a label (2–4 words, no sentence punctuation)
    .filter((line) => !(line.split(/\s+/).length <= 4 && !/[.!?]/.test(line)))
    .join('\n');
}

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

type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

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

  const lines = useMemo(() => {
    const source = data?.voiceover ?? data?.briefing ?? '';
    return splitLines(sanitizeForSpeech(source));
  }, [data?.voiceover, data?.briefing]);
  linesRef.current = lines;

  const teardownAudio = useCallback(() => {
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
  }, []);

  const stop = useCallback(() => {
    teardownAudio();
    setStatus('idle');
    setProgress(0);
    setDuration(0);
    setLineIdx(0);
    setSpeaking(false);
  }, [teardownAudio, setSpeaking]);

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

  const attachAudioElement = useCallback(
    (blob: Blob) => {
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
      audio.onplay = () => {
        setStatus('playing');
        setSpeaking(true);
      };
      audio.onpause = () => {
        if (!audio.ended) {
          setStatus('paused');
          setSpeaking(false);
        }
      };
      audio.onended = () => {
        setStatus('paused');
        setSpeaking(false);
      };

      audio.src = url;
      return audio;
    },
    [setSpeaking],
  );

  const waitForReady = (audio: HTMLAudioElement) =>
    new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      audio.oncanplaythrough = finish;
      audio.oncanplay = finish;
      audio.onerror = finish;
      setTimeout(finish, 5000);
    });

  const loadFromStoredUrl = useCallback(
    async (url: string, controller: AbortController) => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Stored audio fetch failed: ${res.status}`);
      const blob = await res.blob();
      const audio = attachAudioElement(blob);
      await waitForReady(audio);
    },
    [attachAudioElement],
  );

  const loadFromTTS = useCallback(
    async (text: string, controller: AbortController) => {
      const endpoint = isIOS() ? '/api/tts' : '/api/tts?stream=true';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
      const blob = await res.blob();
      const audio = attachAudioElement(blob);
      await waitForReady(audio);
    },
    [attachAudioElement],
  );

  // Preload audio whenever the overlay opens with data. Play button just hits
  // audio.play() afterwards — no fetch latency on the first tap, and the scrubber
  // can seek freely once the blob is in memory.
  useEffect(() => {
    if (!open || !data) return;
    const text = data.voiceover || data.briefing;
    if (!text) return;

    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setErrorMsg(null);

    timeoutRef.current = setTimeout(() => {
      if (!cancelled && abortRef.current === controller) {
        controller.abort();
        setStatus('error');
        setErrorMsg('Audio load timed out.');
      }
    }, 20000);

    (async () => {
      try {
        if (data.audioUrl) {
          try {
            await loadFromStoredUrl(data.audioUrl, controller);
            if (!cancelled) setStatus('ready');
            return;
          } catch (storedErr) {
            if (controller.signal.aborted) return;
            console.warn('[Briefing] Stored audio failed, falling back to live TTS:', storedErr);
          }
        }
        await loadFromTTS(text, controller);
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[Briefing] Audio load failed:', err);
        if (!cancelled) {
          setStatus('error');
          setErrorMsg('Audio unavailable. Try regenerating the briefing.');
        }
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      teardownAudio();
      setStatus('idle');
      setProgress(0);
      setDuration(0);
      setLineIdx(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data?.audioUrl, data?.voiceover, data?.briefing]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === 'playing') {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch (err) {
        console.warn('[Briefing] Play failed:', err);
      }
    }
  };

  const seek = (pct: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, pct));
    audio.currentTime = clamped * audio.duration;
    setProgress(audio.currentTime);
  };

  if (!open) return null;

  const current = lines[lineIdx] ?? '';
  const preview = lines[lineIdx + 1] ?? '';
  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  const canInteract = status === 'ready' || status === 'playing' || status === 'paused';

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

      <div className="px-4 py-8 sm:px-8 sm:py-16 flex flex-col items-center gap-6 sm:gap-8 min-h-full">
        {/* Subtitle — current line with a muted next-line preview underneath */}
        <div className="w-full max-w-[780px] text-center px-5 min-h-[9rem] sm:min-h-[11rem] flex flex-col justify-end">
          <p className="font-[family-name:var(--font-display)] text-[26px] sm:text-[32px] leading-[1.3] tracking-[-0.015em] text-jarvis-text-primary font-medium">
            {current || (isLoading ? 'Loading briefing…' : lines.length === 0 ? 'No briefing content.' : '—')}
          </p>
          {preview && (
            <p className="mt-3 font-[family-name:var(--font-display)] text-[16px] sm:text-[18px] leading-[1.45] text-jarvis-text-faint">
              {preview}
            </p>
          )}
        </div>

        <div className="w-[min(480px,80vw)] aspect-square relative">
          <Mindmap
            size={480}
            state={isPlaying ? 'speaking' : isLoading ? 'thinking' : 'idle'}
            density="dense"
            className="rounded-3xl w-full h-full"
          />
        </div>

        <div className="w-full max-w-[720px] flex items-center gap-4 px-5 py-3.5 bg-jarvis-bg-card border border-jarvis-border rounded-2xl">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canInteract}
            className="w-11 h-11 rounded-full bg-jarvis-cta text-white flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(37,99,235,0.4)] hover:bg-jarvis-cta-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={isLoading ? 'Loading briefing audio' : isPlaying ? 'Pause briefing' : 'Play briefing'}
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

          {/* Seekable scrubber */}
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={duration > 0 ? Math.round((progress / duration) * 1000) : 0}
            onChange={(e) => seek(Number(e.target.value) / 1000)}
            disabled={!canInteract || duration <= 0}
            aria-label="Seek"
            className="flex-1 h-1 accent-jarvis-ambient cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          />

          <span className="font-[family-name:var(--font-mono)] text-[11px] text-jarvis-text-dim tabular-nums">
            {fmt(progress)} / {fmt(duration)}
          </span>
        </div>

        {status === 'error' && errorMsg && (
          <div className="max-w-[720px] text-[12px] text-jarvis-danger font-[family-name:var(--font-mono)]">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpeaking } from '@/contexts/SpeakingContext';

interface TTSButtonProps {
  text: string;
  audioUrl?: string | null; // Pre-generated audio URL from Supabase Storage
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function TTSButton({ text, audioUrl }: TTSButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setSpeaking, registerStopFn } = useSpeaking();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync speaking state to context overlay
  useEffect(() => {
    setSpeaking(isPlaying);
  }, [isPlaying, setSpeaking]);

  // Register stop function so overlay can stop playback
  const stopPlaybackRef = useRef<() => void>(() => {});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (audioRef.current) audioRef.current.pause();
      setSpeaking(false);
    };
  }, [setSpeaking]);

  const stopPlayback = () => {
    // Abort in-flight fetch
    abortRef.current?.abort();
    abortRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';   // Force stop on Mobile Safari
        audioRef.current.load();     // Reset the audio element
        audioRef.current = null;
      }
    } catch { /* ignore mobile Safari quirks */ }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setIsLoading(false);
  };

  // Keep the ref and context registration in sync
  stopPlaybackRef.current = stopPlayback;
  useEffect(() => {
    registerStopFn(() => stopPlaybackRef.current());
  }, [registerStopFn]);

  const fallbackToWebSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsLoading(false);
  };

  const playAudioBlob = async (blob: Blob) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio();
    audio.setAttribute('playsinline', 'true');
    audio.preload = 'auto';
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    // Set source and wait for enough data before playing
    audio.src = url;

    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error('Audio load failed'));
      // If canplaythrough doesn't fire in 5s, try playing anyway
      setTimeout(resolve, 5000);
    });

    await audio.play();
    setIsPlaying(true);
    setIsLoading(false);
  };

  /**
   * Play pre-generated audio from a URL (Supabase Storage signed URL).
   * Much faster — no TTS generation needed, just fetch the stored file.
   */
  const playStoredAudio = async (url: string, controller: AbortController) => {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw new Error(`Stored audio fetch failed: ${res.status}`);
    }

    const blob = await res.blob();
    await playAudioBlob(blob);
  };

  // Streaming fetch: uses ElevenLabs streaming endpoint for faster server response,
  // but collects all chunks before playing (partial blobs cause early cutoff)
  const playStreaming = async (controller: AbortController) => {
    const res = await fetch('/api/tts?stream=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
    if (!res.body) throw new Error('No response body for streaming');

    // Collect ALL chunks, then play the complete audio
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

  // Non-streaming playback: fetch full audio then play (iOS fallback)
  const playBlob = async (controller: AbortController) => {
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

  const handleToggle = async () => {
    if (isPlaying || isLoading) {
      stopPlayback();
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // Timeout: if audio hasn't started in 20s, fall back to Web Speech
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        console.warn('[TTS] Timeout after 20s, falling back to Web Speech');
        controller.abort();
        fallbackToWebSpeech();
      }
    }, 20000);

    try {
      // Priority 1: Play pre-generated stored audio (instant, no TTS call)
      if (audioUrl) {
        try {
          await playStoredAudio(audioUrl, controller);
          return; // Success — skip fallback paths
        } catch (storedErr) {
          console.warn('[TTS] Stored audio failed, falling back to live TTS:', storedErr);
          // Fall through to live TTS
        }
      }

      // Priority 2: Live TTS generation (ElevenLabs/OpenAI)
      if (isIOS()) {
        await playBlob(controller);
      } else {
        await playStreaming(controller);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[TTS] ElevenLabs/OpenAI failed, falling back to Web Speech:', err);
      fallbackToWebSpeech();
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-lg border border-jarvis-border hover:border-jarvis-accent transition-colors"
      aria-label={isLoading ? 'Loading audio...' : isPlaying ? 'Stop reading' : 'Read briefing aloud'}
      title={isLoading ? 'Loading audio...' : isPlaying ? 'Stop reading' : 'Read briefing aloud'}
    >
      {isLoading ? (
        <div className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-jarvis-accent animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-[10px] text-jarvis-text-dim">Loading...</span>
        </div>
      ) : isPlaying ? (
        <svg
          className="w-4 h-4 text-jarvis-accent"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-jarvis-text-secondary"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      )}
    </button>
  );
}

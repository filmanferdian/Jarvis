'use client';

import { useState, useRef, useEffect } from 'react';

interface TTSButtonProps {
  text: string;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function TTSButton({ text }: TTSButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const stopPlayback = () => {
    // Abort in-flight fetch
    abortRef.current?.abort();
    abortRef.current = null;

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

  const fallbackToWebSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
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
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    await audio.play();
    setIsPlaying(true);
    setIsLoading(false);
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
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    await audio.play();
    setIsPlaying(true);
  };

  const handleToggle = async () => {
    if (isPlaying || isLoading) {
      stopPlayback();
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Use streaming on non-iOS for faster time-to-audio
      if (!isIOS()) {
        await playStreaming(controller);
      } else {
        await playBlob(controller);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Fallback to Web Speech API
      fallbackToWebSpeech();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-lg border border-jarvis-border hover:border-jarvis-accent transition-colors"
      aria-label={isPlaying || isLoading ? 'Stop reading' : 'Read briefing aloud'}
      title={isPlaying || isLoading ? 'Stop reading' : 'Read briefing aloud'}
    >
      {isLoading ? (
        <svg
          className="w-4 h-4 text-jarvis-accent animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
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

'use client';

import { useState, useEffect } from 'react';

interface TTSButtonProps {
  text: string;
}

export default function TTSButton({ text }: TTSButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  if (!isSupported) return null;

  const handleToggle = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-lg border border-jarvis-border hover:border-jarvis-accent transition-colors"
      aria-label={isPlaying ? 'Stop reading' : 'Read briefing aloud'}
      title={isPlaying ? 'Stop reading' : 'Read briefing aloud'}
    >
      {isPlaying ? (
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

'use client';

import { useSpeaking } from '@/contexts/SpeakingContext';
import ArcReactor from './ArcReactor';

export default function SpeakingOverlay() {
  const { isSpeaking, stopAudio } = useSpeaking();

  if (!isSpeaking) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
      onClick={stopAudio}
      role="button"
      aria-label="Tap to stop audio"
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Atmospheric glow layers */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(37,99,235,0.2) 0%, rgba(30,58,95,0.1) 40%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.08) 0%, transparent 60%)',
        }}
      />

      {/* Reactor */}
      <div className="relative z-10">
        <ArcReactor state="speaking" size="full" />
      </div>

      {/* Status label */}
      <div className="relative z-10 mt-8 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-jarvis-success animate-pulse" />
        <span className="text-sm font-medium text-jarvis-text-secondary tracking-wide">
          Speaking
        </span>
      </div>

      {/* Dismiss hint */}
      <span className="relative z-10 mt-4 text-[10px] text-jarvis-text-dim">
        Tap anywhere to stop
      </span>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
}

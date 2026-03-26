'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

interface SpeakingContextValue {
  isSpeaking: boolean;
  setSpeaking: (speaking: boolean) => void;
  stopAudio: () => void;
  registerStopFn: (fn: () => void) => void;
}

const SpeakingContext = createContext<SpeakingContextValue>({
  isSpeaking: false,
  setSpeaking: () => {},
  stopAudio: () => {},
  registerStopFn: () => {},
});

export function SpeakingProvider({ children }: { children: React.ReactNode }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const stopFnRef = useRef<(() => void) | null>(null);

  const setSpeaking = useCallback((speaking: boolean) => {
    setIsSpeaking(speaking);
  }, []);

  const registerStopFn = useCallback((fn: () => void) => {
    stopFnRef.current = fn;
  }, []);

  const stopAudio = useCallback(() => {
    stopFnRef.current?.();
    setIsSpeaking(false);
  }, []);

  return (
    <SpeakingContext.Provider value={{ isSpeaking, setSpeaking, stopAudio, registerStopFn }}>
      {children}
    </SpeakingContext.Provider>
  );
}

export function useSpeaking() {
  return useContext(SpeakingContext);
}

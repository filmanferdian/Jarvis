'use client';

import { useCallback, useRef, useState } from 'react';
import Toast from './Toast';

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : never;

export default function VoiceMic() {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionType> | null>(null);

  const handleDismiss = useCallback(() => setToast(null), []);

  const startListening = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionType }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionType }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setToast('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new (SpeechRecognition as unknown as new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      continuous: boolean;
      start: () => void;
      stop: () => void;
      onresult: ((event: { results: { item: (index: number) => { item: (index: number) => { transcript: string } } } }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
    })();

    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = async (event) => {
      const transcript = event.results.item(0).item(0).transcript;
      setListening(false);
      setProcessing(true);

      try {
        const res = await fetch('/api/voice/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ transcript }),
        });

        if (res.ok) {
          const data = await res.json();
          setToast(data.response || 'Got it.');
        } else {
          setToast('Sorry, I had trouble processing that.');
        }
      } catch {
        setToast('Connection error. Please try again.');
      } finally {
        setProcessing(false);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setToast("I didn't catch that. Try again?");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition as unknown as InstanceType<SpeechRecognitionType>;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      (recognitionRef.current as unknown as { stop: () => void }).stop();
    }
    setListening(false);
  };

  return (
    <>
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={listening ? stopListening : startListening}
          disabled={processing}
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
            listening
              ? 'border-jarvis-accent bg-jarvis-accent/10 animate-pulse'
              : processing
                ? 'border-jarvis-warn bg-jarvis-warn/5'
                : 'border-jarvis-border hover:border-jarvis-accent/50'
          } disabled:opacity-50`}
          aria-label={listening ? 'Stop listening' : 'Start voice input'}
        >
          {processing ? (
            <svg className="w-6 h-6 text-jarvis-warn animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className={`w-6 h-6 ${listening ? 'text-jarvis-accent' : 'text-jarvis-text-dim'}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>
      {toast && <Toast message={toast} onDismiss={handleDismiss} />}
    </>
  );
}

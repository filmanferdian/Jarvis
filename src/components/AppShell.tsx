'use client';

import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';
import CommandPalette from '@/components/CommandPalette';
import { SpeakingProvider } from '@/contexts/SpeakingContext';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteVoice, setPaletteVoice] = useState(false);

  const openPalette = useCallback((options?: { voice?: boolean }) => {
    setPaletteVoice(!!options?.voice);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteVoice(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <AuthGate>
      <SpeakingProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar onOpenPalette={openPalette} />
            <main className="flex-1 overflow-y-auto px-8 py-7 pb-20 bg-jarvis-bg">
              <div className="max-w-[1400px] mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
        <CommandPalette open={paletteOpen} initialVoice={paletteVoice} onClose={closePalette} />
      </SpeakingProvider>
    </AuthGate>
  );
}

'use client';

import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import BriefingCard from '@/components/BriefingCard';
import ScheduleStrip from '@/components/ScheduleStrip';
import AuthGate from '@/components/AuthGate';

export default function Dashboard() {
  return (
    <AuthGate>
      <div className="flex flex-col h-screen">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            <BriefingCard />
            <ScheduleStrip />

          {/* Mobile mic placeholder - Sprint 2 */}
          <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2">
            <div className="w-16 h-16 rounded-full border-2 border-jarvis-border flex items-center justify-center">
              <svg
                className="w-6 h-6 text-jarvis-text-dim"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
          </div>
          </main>
        </div>
      </div>
    </AuthGate>
  );
}

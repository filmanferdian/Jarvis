'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import BriefingCard from '@/components/BriefingCard';
import ScheduleStrip from '@/components/ScheduleStrip';
import TasksCard from '@/components/TasksCard';
import EmailCard from '@/components/EmailCard';
import HealthCard from '@/components/HealthCard';
import KpiRow from '@/components/KpiRow';
import VoiceMic from '@/components/VoiceMic';
import AuthGate from '@/components/AuthGate';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-sync on dashboard load (fire-and-forget, debounced server-side)
  useEffect(() => {
    const token = localStorage.getItem('jarvis_token');
    if (!token) return;
    fetch('/api/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {}); // silently ignore errors
  }, []);

  return (
    <AuthGate>
      <div className="flex flex-col h-screen">
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            <KpiRow />
            <BriefingCard />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScheduleStrip />
              <TasksCard />
            </div>
            <EmailCard />
            <HealthCard />

            <VoiceMic />
          </main>
        </div>
      </div>
    </AuthGate>
  );
}

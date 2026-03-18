'use client';

import { useState } from 'react';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import BriefingCard from '@/components/BriefingCard';
import ScheduleStrip from '@/components/ScheduleStrip';
import TasksCard from '@/components/TasksCard';
import EmailCard from '@/components/EmailCard';
import FitnessCard from '@/components/FitnessCard';
import HealthCard from '@/components/HealthCard';
import KpiRow from '@/components/KpiRow';
import VoiceMic from '@/components/VoiceMic';
import AuthGate from '@/components/AuthGate';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FitnessCard />
              <HealthCard />
            </div>

            <VoiceMic />
          </main>
        </div>
      </div>
    </AuthGate>
  );
}

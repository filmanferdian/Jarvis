'use client';

import { useEffect, useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import ArcReactor from '@/components/ArcReactor';

function useTimeGreeting() {
  const [greeting, setGreeting] = useState('Good evening');

  useEffect(() => {
    function update() {
      const wibOffset = 7 * 60 * 60 * 1000;
      const wib = new Date(Date.now() + wibOffset);
      const hour = wib.getUTCHours();
      if (hour < 12) setGreeting('Good morning');
      else if (hour < 17) setGreeting('Good afternoon');
      else setGreeting('Good evening');
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  return greeting;
}
import BriefingCard from '@/components/BriefingCard';
import ScheduleStrip from '@/components/ScheduleStrip';
import TasksCard from '@/components/TasksCard';
import EmailCard from '@/components/EmailCard';
import NewsCard from '@/components/NewsCard';
import FitnessCard from '@/components/FitnessCard';
import HealthCard from '@/components/HealthCard';
import KpiRow from '@/components/KpiRow';
import VoiceMic from '@/components/VoiceMic';

export default function Dashboard() {
  const greeting = useTimeGreeting();

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
    <AppShell>
      {/* Jarvis Hero — visual identity */}
      <div className="flex items-center gap-4 py-2">
        <ArcReactor state="idle" size="md" />
        <div>
          <p className="text-[15px] font-medium text-jarvis-text-primary">{greeting}, Filman</p>
          <p className="text-xs text-jarvis-text-muted">Standing by...</p>
        </div>
      </div>

      <KpiRow />
      <BriefingCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ScheduleStrip />
        <TasksCard />
      </div>
      <EmailCard />
      <NewsCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FitnessCard />
        <HealthCard />
      </div>
      <VoiceMic />
    </AppShell>
  );
}

'use client';

import { useEffect } from 'react';
import AppShell from '@/components/AppShell';
import BriefingHero from '@/components/BriefingHero';
import ScheduleStrip from '@/components/ScheduleStrip';
import TasksCard from '@/components/TasksCard';
import EmailCard from '@/components/EmailCard';
import NewsCard from '@/components/NewsCard';
import FitnessCard from '@/components/FitnessCard';
import KpiRow from '@/components/KpiRow';

export default function Dashboard() {
  // Auto-sync on dashboard load (fire-and-forget, debounced server-side).
  useEffect(() => {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: '{}',
    }).catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="space-y-5">
        <BriefingHero />
        <KpiRow />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ScheduleStrip />
          <TasksCard />
        </div>
        <EmailCard />
        <NewsCard />
        <FitnessCard />
      </div>
    </AppShell>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import BriefingOverlay, { type BriefingData } from '@/components/BriefingOverlay';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';

export default function BriefingPage() {
  const router = useRouter();
  const { data } = usePolling<BriefingData>(
    () => fetchAuth('/api/briefing'),
    5 * 60 * 1000
  );

  return (
    <AppShell>
      <BriefingOverlay
        open
        data={data ?? null}
        onClose={() => router.push('/')}
      />
    </AppShell>
  );
}

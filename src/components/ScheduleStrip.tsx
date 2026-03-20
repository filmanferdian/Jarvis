'use client';

import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';

interface CalendarEvent {
  id: string;
  event_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  is_all_day: boolean;
}

interface CalendarData {
  date: string;
  events: CalendarEvent[];
  count: number;
}

export default function ScheduleStrip() {
  const { data, loading } = usePolling<CalendarData>(
    () => fetchAuth('/api/calendar'),
    5 * 60 * 1000
  );

  const events = data?.events ?? [];

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });

  const isDeepWork = (title: string) =>
    title.toLowerCase().includes('deep work') ||
    title.toLowerCase().includes('focus');

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/4" />
          <div className="h-8 bg-jarvis-border rounded" />
          <div className="h-8 bg-jarvis-border rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <h2 className="text-[15px] font-medium text-jarvis-text-primary mb-4">
        Today&apos;s Schedule
      </h2>
      {events.length === 0 ? (
        <p className="text-base text-jarvis-text-dim">No events today.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                isDeepWork(event.title)
                  ? 'bg-jarvis-accent/5 border border-jarvis-accent/20'
                  : 'hover:bg-jarvis-bg-card'
              }`}
            >
              <span className="text-sm font-mono text-jarvis-text-muted w-14 shrink-0">
                {event.is_all_day ? 'All day' : formatTime(event.start_time)}
              </span>
              <div
                className={`w-1 h-6 rounded-full ${
                  isDeepWork(event.title)
                    ? 'bg-jarvis-accent'
                    : 'bg-jarvis-text-dim'
                }`}
              />
              <span
                className={`text-base ${
                  isDeepWork(event.title)
                    ? 'text-jarvis-accent'
                    : 'text-jarvis-text-secondary'
                }`}
              >
                {event.title}
              </span>
              {event.end_time && !event.is_all_day && (
                <span className="text-sm text-jarvis-text-dim ml-auto">
                  → {formatTime(event.end_time)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

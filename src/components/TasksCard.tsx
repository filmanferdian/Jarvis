'use client';

import { useEffect, useState } from 'react';

interface ClickUpTask {
  id: string;
  task_id: string;
  name: string;
  due_date: string | null;
  priority: number | null;
  status: string;
  list_name: string | null;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Urgent', color: 'text-red-400' },
  2: { label: 'High', color: 'text-jarvis-warn' },
  3: { label: 'Normal', color: 'text-jarvis-text-secondary' },
  4: { label: 'Low', color: 'text-jarvis-text-dim' },
};

const STATUS_COLORS: Record<string, string> = {
  'in progress': 'bg-jarvis-accent',
  'to do': 'bg-jarvis-text-dim',
  open: 'bg-jarvis-text-dim',
  review: 'bg-jarvis-warn',
};

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TasksCard() {
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const token = localStorage.getItem('jarvis_token') || '';
        const res = await fetch('/api/tasks', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/4" />
          <div className="h-8 bg-jarvis-border rounded" />
          <div className="h-8 bg-jarvis-border rounded" />
          <div className="h-8 bg-jarvis-border rounded" />
        </div>
      </div>
    );
  }

  const overdueTasks = tasks.filter((t) => isOverdue(t.due_date));
  const upcomingTasks = tasks.filter((t) => !isOverdue(t.due_date));

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-jarvis-accent uppercase tracking-wider">
          Tasks This Week
        </h2>
        <span className="text-xs text-jarvis-text-dim font-mono">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-jarvis-text-dim">No tasks due this week.</p>
      ) : (
        <div className="space-y-4">
          {overdueTasks.length > 0 && (
            <div>
              <p className="text-xs text-red-400 font-medium mb-2 uppercase tracking-wider">
                Overdue
              </p>
              <div className="space-y-1">
                {overdueTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {upcomingTasks.length > 0 && (
            <div>
              {overdueTasks.length > 0 && (
                <p className="text-xs text-jarvis-text-muted font-medium mb-2 uppercase tracking-wider">
                  Upcoming
                </p>
              )}
              <div className="space-y-1">
                {upcomingTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: ClickUpTask }) {
  const priority = task.priority ? PRIORITY_LABELS[task.priority] : null;
  const statusColor =
    STATUS_COLORS[task.status?.toLowerCase()] || 'bg-jarvis-text-dim';
  const overdue = isOverdue(task.due_date);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jarvis-bg-card group">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
      <span className="text-sm text-jarvis-text-secondary truncate flex-1">
        {task.name}
      </span>
      {task.list_name && (
        <span className="text-xs text-jarvis-text-dim hidden group-hover:inline">
          {task.list_name}
        </span>
      )}
      {priority && (
        <span className={`text-xs font-mono ${priority.color}`}>
          {priority.label}
        </span>
      )}
      {task.due_date && (
        <span
          className={`text-xs font-mono shrink-0 ${
            overdue ? 'text-red-400' : 'text-jarvis-text-muted'
          }`}
        >
          {formatDueDate(task.due_date)}
        </span>
      )}
    </div>
  );
}

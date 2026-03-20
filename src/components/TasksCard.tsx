'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { fetchAuth } from '@/lib/fetchAuth';

interface NotionTask {
  id: string;
  notion_page_id: string;
  name: string;
  due_date: string | null;
  priority: 'Low' | 'Medium' | 'High' | null;
  status: string;
  project_name: string | null;
  tags: string[] | null;
}

interface TasksData {
  date: string;
  tasks: NotionTask[];
  count: number;
}

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  High: { label: 'High', color: 'text-red-400' },
  Medium: { label: 'Med', color: 'text-jarvis-warn' },
  Low: { label: 'Low', color: 'text-jarvis-text-dim' },
};

const STATUS_COLORS: Record<string, string> = {
  'In Progress': 'bg-jarvis-accent',
  'Not Started': 'bg-jarvis-text-dim',
  Done: 'bg-emerald-400',
  Archived: 'bg-jarvis-text-dim',
};

// Tasks are read-only — status managed in Notion

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
  const { data, loading, refetch } = usePolling<TasksData>(
    () => fetchAuth('/api/tasks'),
    5 * 60 * 1000
  );

  const [showForm, setShowForm] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<string>('Medium');
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const tasks = data?.tasks ?? [];

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newTaskName.trim(),
          priority: newTaskPriority,
        }),
      });

      if (res.ok) {
        setNewTaskName('');
        setShowForm(false);
        await refetch();
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync/notion', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await refetch();
      }
    } catch {
      // Silently fail
    } finally {
      setSyncing(false);
    }
  };

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
        <h2 className="text-[15px] font-medium text-jarvis-text-primary">
          Tasks This Week
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-jarvis-text-dim font-mono">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-jarvis-text-muted hover:text-jarvis-accent transition-colors disabled:opacity-50"
            title="Sync from Notion"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-jarvis-accent hover:text-jarvis-accent/80 transition-colors"
            title="Add task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick-add form */}
      {showForm && (
        <form onSubmit={handleAddTask} className="mb-4 space-y-2">
          <input
            type="text"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Task name..."
            className="w-full px-3 py-2 text-base rounded-lg border border-jarvis-border bg-jarvis-bg text-jarvis-text-primary placeholder-jarvis-text-dim focus:outline-none focus:border-jarvis-accent"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-jarvis-border bg-jarvis-bg text-jarvis-text-secondary focus:outline-none focus:border-jarvis-accent"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <button
              type="submit"
              disabled={submitting || !newTaskName.trim()}
              className="px-3 py-1 text-sm rounded bg-jarvis-accent text-jarvis-bg font-medium hover:bg-jarvis-accent/80 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1 text-sm rounded border border-jarvis-border text-jarvis-text-muted hover:text-jarvis-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-base text-jarvis-text-dim">No tasks due this week.</p>
      ) : (
        <div className="space-y-4">
          {overdueTasks.length > 0 && (
            <div>
              <p className="text-sm text-red-400 font-medium mb-2 uppercase tracking-wider">
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
                <p className="text-sm text-jarvis-text-muted font-medium mb-2 uppercase tracking-wider">
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

function TaskRow({ task }: { task: NotionTask }) {
  const priority = task.priority ? PRIORITY_STYLES[task.priority] : null;
  const statusColor = STATUS_COLORS[task.status] || 'bg-jarvis-text-dim';
  const overdue = isOverdue(task.due_date);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jarvis-bg-card group relative">
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor}`}
          title={task.status}
        />
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:inline-block text-[10px] text-jarvis-text-dim bg-jarvis-bg border border-jarvis-border rounded px-1.5 py-0.5 whitespace-nowrap z-10">
          {task.status}
        </span>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className={`text-base truncate ${task.status === 'Done' ? 'line-through text-jarvis-text-dim' : 'text-jarvis-text-secondary'}`}>
          {task.name}
        </span>
        {task.project_name && (
          <span className="text-xs text-jarvis-text-muted truncate">{task.project_name}</span>
        )}
      </div>
      {priority && (
        <span className={`text-sm font-mono ${priority.color}`}>
          {priority.label}
        </span>
      )}
      {task.due_date && (
        <span
          className={`text-sm font-mono shrink-0 ${
            overdue ? 'text-red-400' : 'text-jarvis-text-muted'
          }`}
        >
          {formatDueDate(task.due_date)}
        </span>
      )}
    </div>
  );
}

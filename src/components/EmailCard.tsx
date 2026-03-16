'use client';

import { useEffect, useState } from 'react';

interface EmailData {
  date: string;
  synthesis: string | null;
  importantCount?: number;
  deadlineCount?: number;
  createdAt?: string;
  message?: string;
}

export default function EmailCard() {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchEmails() {
      try {
        const token = localStorage.getItem('jarvis_token') || '';
        const res = await fetch('/api/emails', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchEmails();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-jarvis-border rounded w-1/3" />
          <div className="h-3 bg-jarvis-border rounded w-full" />
        </div>
      </div>
    );
  }

  if (!data?.synthesis) {
    return (
      <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
        <h2 className="text-sm font-medium text-jarvis-text-muted mb-2">
          Email Digest
        </h2>
        <p className="text-sm text-jarvis-text-dim">
          {data?.message || 'No email synthesis available yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-jarvis-accent uppercase tracking-wider">
          Email Digest
        </h2>
        <div className="flex items-center gap-3">
          {(data.importantCount ?? 0) > 0 && (
            <span className="text-xs font-mono text-jarvis-warn">
              {data.importantCount} important
            </span>
          )}
          {(data.deadlineCount ?? 0) > 0 && (
            <span className="text-xs font-mono text-red-400">
              {data.deadlineCount} deadline{data.deadlineCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <svg
          className={`w-3 h-3 text-jarvis-text-muted transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="text-sm text-jarvis-text-secondary">
          {expanded ? 'Hide synthesis' : 'Show synthesis'}
        </span>
      </button>

      {expanded && (
        <p className="mt-3 text-sm text-jarvis-text-secondary whitespace-pre-line border-l-2 border-jarvis-accent pl-4">
          {data.synthesis}
        </p>
      )}
    </div>
  );
}

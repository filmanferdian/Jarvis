'use client';

const DOMAINS = [
  'Work',
  'Wealth',
  'Side projects',
  'Health',
  'Fitness',
  'Spiritual',
  'Family',
  'Learning',
  'Networking',
  'Personal branding',
];

export default function Sidebar() {
  return (
    <aside className="w-[280px] border-r border-jarvis-border p-4 hidden md:block">
      <h2 className="text-xs uppercase tracking-wider text-jarvis-text-muted mb-4">
        Life Domains
      </h2>
      <div className="space-y-2">
        {DOMAINS.map((domain) => (
          <div
            key={domain}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jarvis-bg-card transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-jarvis-text-dim" />
            <span className="text-sm text-jarvis-text-secondary">{domain}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 p-4 rounded-lg border border-jarvis-border">
        <p className="text-xs text-jarvis-text-muted text-center">
          Domain health ring &amp; KPI cards coming in Sprint 2
        </p>
      </div>
    </aside>
  );
}

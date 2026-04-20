'use client';

import { useEffect, useState } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';

interface AccountHealth {
  account_key: string;
  last_synced_at: string | null;
  last_result: string | null;
  last_error: string | null;
  elapsed_minutes: number;
  status: 'ok' | 'warning' | 'error';
}

interface Integration {
  sync_type: string;
  label: string;
  description: string;
  last_synced_at: string | null;
  last_result: string;
  last_error: string | null;
  events_synced: number | null;
  status: 'ok' | 'warning' | 'error';
  elapsed_minutes: number;
  expected_interval_minutes: number;
  accounts?: AccountHealth[];
}

interface ServiceUsage {
  calls: number;
  tokens_input: number;
  tokens_output: number;
  characters: number;
  estimated_cost_usd: number;
}

interface CostSummary {
  variable_usd: number;
  fixed_usd: number;
  fixed_breakdown: Record<string, number>;
  base_costs?: Record<string, { amount: number; type: 'fixed' | 'usage-based' }>;
  total_estimated_usd: number;
}

interface UsageData {
  billing_month: string;
  services: Record<string, ServiceUsage>;
  elevenlabs_quota: {
    used: number;
    limit: number;
    remaining: number;
    pct_used: number;
    reset_at?: string;
  };
  cost_summary: CostSummary;
  prev_month?: {
    billing_month: string;
    services: Record<string, ServiceUsage>;
    cost_summary: CostSummary;
  };
}

interface CronJobStatus {
  lastRun: string;
  status: string;
  message: string | null;
  durationMs: number | null;
}

interface CronStatusResponse {
  jobs: Record<string, CronJobStatus>;
}

const SERVICE_LABELS: Record<string, string> = {
  claude: 'Claude (Anthropic)',
  elevenlabs: 'ElevenLabs',
  openai: 'OpenAI',
  google: 'Google',
  microsoft: 'Microsoft',
  garmin: 'Garmin',
  notion: 'Notion',
};

const CONNECTOR_ICON: Record<string, string> = {
  'google-calendar': 'GC',
  'outlook-calendar': 'OC',
  'notion-tasks': 'NT',
  'notion-context': 'NC',
  garmin: 'GA',
  fitness: 'FT',
  'email-synthesis': 'ES',
  'email-triage': 'ET',
  'news-synthesis': 'NS',
  'contact-scan': 'CS',
  'running-analysis': 'RA',
  'morning-briefing': 'MB',
};

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function formatWibDateTime(iso: string): string {
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const mo = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  const h = String(wib.getUTCHours()).padStart(2, '0');
  const mi = String(wib.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

function statusLightColor(status: 'ok' | 'warning' | 'error'): string {
  if (status === 'ok') return 'var(--color-jarvis-good)';
  if (status === 'warning') return 'var(--color-jarvis-warn)';
  return 'var(--color-jarvis-danger)';
}

function ConnectorCard({ int }: { int: Integration }) {
  const accounts = int.accounts ?? [];
  const hasUnhealthy = accounts.some((a) => a.status !== 'ok');
  const [expanded, setExpanded] = useState(hasUnhealthy);
  const expandable = accounts.length > 0;

  return (
    <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5">
      <div className="grid grid-cols-[48px_1fr_auto] gap-4 items-center">
        <div
          className="w-12 h-12 rounded-[12px] flex items-center justify-center text-[13px] font-semibold text-jarvis-text-dim"
          style={{
            background: 'var(--color-jarvis-bg-deep)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {CONNECTOR_ICON[int.sync_type] ?? int.label.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-jarvis-text-primary truncate">{int.label}</p>
          <p className="flex items-center gap-2 text-[11.5px] text-jarvis-text-faint mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
            <span
              className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
              style={{ background: statusLightColor(int.status) }}
            />
            <span className="truncate">
              {int.last_synced_at ? formatElapsed(int.elapsed_minutes) : 'Never synced'}
              {int.events_synced != null && int.events_synced > 0 && ` · ${int.events_synced} items`}
            </span>
          </p>
        </div>
        {expandable && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-jarvis-text-faint hover:text-jarvis-text-dim transition-colors"
          >
            {accounts.length} {expanded ? '▾' : '▸'}
          </button>
        )}
      </div>

      {int.description && (
        <p className="text-[11.5px] text-jarvis-text-faint mt-2.5">{int.description}</p>
      )}
      {int.last_error && int.status !== 'ok' && (
        <p className="text-[11.5px] text-jarvis-danger mt-2 truncate" title={int.last_error}>
          {int.last_error.slice(0, 120)}
        </p>
      )}

      {expandable && expanded && (
        <div className="border-t border-jarvis-border mt-3 pt-3 space-y-2">
          {accounts.map((a) => (
            <div key={a.account_key} className="flex items-start gap-2">
              <span
                className="inline-block w-[6px] h-[6px] rounded-full shrink-0 mt-1.5"
                style={{ background: statusLightColor(a.status) }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] text-jarvis-text-dim truncate">{a.account_key}</p>
                <p className="text-[10.5px] text-jarvis-text-faint" style={{ fontFamily: 'var(--font-mono)' }}>
                  {a.last_synced_at ? formatElapsed(a.elapsed_minutes) : 'Never synced'}
                </p>
                {a.last_error && a.status !== 'ok' && (
                  <p className="text-[10.5px] text-jarvis-danger truncate" title={a.last_error}>
                    {a.last_error.slice(0, 120)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UtilitiesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [cronStatus, setCronStatus] = useState<CronStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [styleAnalysis, setStyleAnalysis] = useState<string | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [intRes, usageRes, cronRes] = await Promise.allSettled([
          fetchAuth<{ integrations: Integration[] }>('/api/utilities/integrations'),
          fetchAuth<UsageData>('/api/utilities/usage'),
          fetchAuth<CronStatusResponse>('/api/cron/status'),
        ]);
        if (intRes.status === 'fulfilled') setIntegrations(intRes.value.integrations);
        if (usageRes.status === 'fulfilled') setUsage(usageRes.value);
        if (cronRes.status === 'fulfilled') setCronStatus(cronRes.value);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cronRows = cronStatus
    ? Object.entries(cronStatus.jobs)
        .map(([name, info]) => ({ name, ...info }))
        .sort((a, b) => new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime())
    : [];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1
            className="text-[22px] text-jarvis-text-primary"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            Utilities
          </h1>
          <p className="text-[12px] text-jarvis-text-dim mt-0.5">
            Integration health, cron log, and monthly API usage.
          </p>
        </div>

        {/* Connectors */}
        <div>
          <h2 className="text-[13px] uppercase text-jarvis-text-faint mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
            Connectors
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5 h-24 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((int) => (
                <ConnectorCard key={int.sync_type} int={int} />
              ))}
            </div>
          )}
        </div>

        {/* Cron log */}
        {cronRows.length > 0 && (
          <div>
            <h2 className="text-[13px] uppercase text-jarvis-text-faint mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
              Recent cron runs
            </h2>
            <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card overflow-hidden">
              <div
                className="hidden md:grid gap-3 px-4 py-3 text-[10px] uppercase text-jarvis-text-faint"
                style={{
                  gridTemplateColumns: '1fr 120px 90px 90px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  background: 'var(--color-jarvis-bg-elevated)',
                }}
              >
                <span>Job</span>
                <span>Last run (WIB)</span>
                <span>Duration</span>
                <span>Status</span>
              </div>
              {cronRows.map((row) => {
                const statusColor =
                  row.status === 'success'
                    ? 'var(--color-jarvis-good)'
                    : row.status === 'skipped'
                      ? 'var(--color-jarvis-text-faint)'
                      : 'var(--color-jarvis-danger)';
                return (
                  <div
                    key={row.name}
                    className="px-4 py-3 border-t border-jarvis-border text-[11.5px] text-jarvis-text-dim md:grid md:gap-3 md:py-2.5 md:[grid-template-columns:1fr_120px_90px_90px]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {/* Job + (mobile) status inline */}
                    <div className="flex items-center justify-between gap-2 md:block">
                      <span className="truncate text-jarvis-text-primary">{row.name}</span>
                      <span style={{ color: statusColor }} className="capitalize md:hidden shrink-0">
                        {row.status}
                      </span>
                    </div>
                    {/* Last run · Duration — stacked on mobile, own grid cells on desktop */}
                    <div className="flex items-center gap-2 mt-1 text-jarvis-text-faint md:mt-0 md:contents md:text-jarvis-text-dim">
                      <span>{formatWibDateTime(row.lastRun)}</span>
                      <span className="md:hidden">·</span>
                      <span>{row.durationMs != null ? `${row.durationMs}ms` : '—'}</span>
                    </div>
                    {/* Status — desktop column 4 */}
                    <span style={{ color: statusColor }} className="capitalize hidden md:inline">
                      {row.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* API Usage */}
        {usage && (
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[13px] uppercase text-jarvis-text-faint" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                API usage · {usage.billing_month}
              </h2>
            </div>
            <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5 space-y-5">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-jarvis-text-faint border-b border-jarvis-border">
                      <th className="text-left py-2 font-normal">Service</th>
                      <th className="text-right py-2 font-normal">Calls</th>
                      <th className="text-right py-2 font-normal hidden sm:table-cell">Tokens in</th>
                      <th className="text-right py-2 font-normal hidden sm:table-cell">Tokens out</th>
                      <th className="text-right py-2 font-normal hidden sm:table-cell">Chars</th>
                      <th className="text-right py-2 font-normal">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usage.services)
                      .filter(([svc, row]) => svc !== 'elevenlabs' && row.calls > 0)
                      .map(([svc, row]) => (
                        <tr key={svc} className="border-b border-jarvis-border last:border-b-0">
                          <td className="py-2 text-jarvis-text-dim">{SERVICE_LABELS[svc] || svc}</td>
                          <td className="py-2 text-right font-mono text-jarvis-text-primary">
                            {row.calls.toLocaleString()}
                          </td>
                          <td className="py-2 text-right font-mono text-jarvis-text-dim hidden sm:table-cell">
                            {row.tokens_input > 0 ? row.tokens_input.toLocaleString() : '—'}
                          </td>
                          <td className="py-2 text-right font-mono text-jarvis-text-dim hidden sm:table-cell">
                            {row.tokens_output > 0 ? row.tokens_output.toLocaleString() : '—'}
                          </td>
                          <td className="py-2 text-right font-mono text-jarvis-text-dim hidden sm:table-cell">
                            {row.characters > 0 ? row.characters.toLocaleString() : '—'}
                          </td>
                          <td className="py-2 text-right font-mono text-jarvis-text-primary">
                            {row.estimated_cost_usd > 0 ? `$${row.estimated_cost_usd.toFixed(2)}` : '$0'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* ElevenLabs quota */}
              <div className="rounded-[10px] border border-jarvis-border p-3">
                <div className="flex items-center justify-between text-[12px] mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-jarvis-text-dim">ElevenLabs credits</span>
                    {usage.elevenlabs_quota.reset_at && (
                      <span className="text-[10.5px] text-jarvis-text-faint">
                        resets{' '}
                        {new Date(usage.elevenlabs_quota.reset_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <span
                    className="font-mono text-[12px]"
                    style={{
                      color:
                        usage.elevenlabs_quota.pct_used > 90
                          ? 'var(--color-jarvis-danger)'
                          : usage.elevenlabs_quota.pct_used > 70
                            ? 'var(--color-jarvis-warn)'
                            : 'var(--color-jarvis-text-dim)',
                    }}
                  >
                    {usage.elevenlabs_quota.used.toLocaleString()} /{' '}
                    {usage.elevenlabs_quota.limit.toLocaleString()}
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--color-jarvis-track)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, usage.elevenlabs_quota.pct_used)}%`,
                      background:
                        usage.elevenlabs_quota.pct_used > 90
                          ? 'var(--color-jarvis-danger)'
                          : usage.elevenlabs_quota.pct_used > 70
                            ? 'var(--color-jarvis-warn)'
                            : 'var(--color-jarvis-ambient)',
                    }}
                  />
                </div>
              </div>

              {/* Cost summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10.5px] uppercase text-jarvis-text-faint mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                    {usage.billing_month} · current
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <CostCell label="Variable" value={usage.cost_summary.variable_usd} />
                    <CostCell label="Base" value={usage.cost_summary.fixed_usd} />
                    <CostCell
                      label="Total"
                      value={usage.cost_summary.total_estimated_usd}
                      highlight
                    />
                  </div>
                </div>
                {usage.prev_month && (
                  <div className="border-t md:border-t-0 md:border-l border-jarvis-border pt-4 md:pt-0 md:pl-5">
                    <p className="text-[10.5px] uppercase text-jarvis-text-faint mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                      {usage.prev_month.billing_month} · previous
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <CostCell label="Variable" value={usage.prev_month.cost_summary.variable_usd} dim />
                      <CostCell label="Base" value={usage.prev_month.cost_summary.fixed_usd} dim />
                      <CostCell
                        label="Total"
                        value={usage.prev_month.cost_summary.total_estimated_usd}
                        dim
                      />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-jarvis-text-faint">
                {usage.cost_summary.base_costs
                  ? Object.entries(usage.cost_summary.base_costs).map(([name, info], i) => (
                      <span key={name}>
                        {i > 0 && ' + '}
                        {name.charAt(0).toUpperCase() + name.slice(1)} ${info.amount}/mo
                        {info.type === 'usage-based' && <span className="opacity-60"> (usage-based)</span>}
                      </span>
                    ))
                  : `Railway $${usage.cost_summary.fixed_breakdown.railway}/mo + ElevenLabs $${usage.cost_summary.fixed_breakdown.elevenlabs}/mo`}
              </p>
            </div>
          </div>
        )}

        {/* Email style analysis */}
        <div>
          <h2 className="text-[13px] uppercase text-jarvis-text-faint mb-3" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
            Email style analysis
          </h2>
          <div className="rounded-[14px] border border-jarvis-border bg-jarvis-bg-card p-5">
            <p className="text-[12px] text-jarvis-text-dim mb-4">
              Fetch recent sent emails from Outlook and Gmail, then analyze your communication style
              with Claude.
            </p>
            {!styleAnalysis ? (
              <button
                onClick={async () => {
                  setStyleLoading(true);
                  setStyleError(null);
                  try {
                    const res = await fetchAuth<{
                      analysis: string;
                      emailCount: number;
                      errors?: string[];
                    }>('/api/emails/style-analysis');
                    setStyleAnalysis(res.analysis);
                    if (res.errors?.length) setStyleError(`Warnings: ${res.errors.join(', ')}`);
                  } catch (err) {
                    setStyleError(err instanceof Error ? err.message : 'Failed to analyze');
                  } finally {
                    setStyleLoading(false);
                  }
                }}
                disabled={styleLoading}
                className="px-4 py-2 text-[12px] rounded-[8px] text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-jarvis-cta)' }}
              >
                {styleLoading ? 'Analyzing sent emails…' : 'Analyze my email style'}
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setStyleAnalysis(null)}
                  className="text-[11.5px]"
                  style={{ color: 'var(--color-jarvis-cta)' }}
                >
                  Run again
                </button>
                <div className="text-[13px] text-jarvis-text-dim whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                  {styleAnalysis}
                </div>
              </div>
            )}
            {styleError && <p className="mt-2 text-[11.5px] text-jarvis-danger">{styleError}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CostCell({
  label,
  value,
  highlight,
  dim,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className="text-[16px] font-mono font-semibold"
        style={{
          color: highlight
            ? 'var(--color-jarvis-cta)'
            : dim
              ? 'var(--color-jarvis-text-faint)'
              : 'var(--color-jarvis-text-primary)',
        }}
      >
        ${value.toFixed(2)}
      </p>
      <p className="text-[10px] uppercase text-jarvis-text-faint mt-0.5" style={{ letterSpacing: '0.08em' }}>
        {label}
      </p>
    </div>
  );
}

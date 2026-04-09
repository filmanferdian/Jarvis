'use client';

import { useEffect, useState } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import AppShell from '@/components/AppShell';

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
  elevenlabs_quota: { used: number; limit: number; remaining: number; pct_used: number; reset_at?: string };
  cost_summary: CostSummary;
  prev_month?: {
    billing_month: string;
    services: Record<string, ServiceUsage>;
    cost_summary: CostSummary;
  };
}

const STATUS_DOT = {
  ok: 'bg-jarvis-success',
  warning: 'bg-jarvis-warn',
  error: 'bg-jarvis-danger',
};

const SERVICE_LABELS: Record<string, string> = {
  claude: 'Claude (Anthropic)',
  elevenlabs: 'ElevenLabs',
  openai: 'OpenAI',
  google: 'Google',
  microsoft: 'Microsoft',
  garmin: 'Garmin',
  notion: 'Notion',
};

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export default function UtilitiesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [styleAnalysis, setStyleAnalysis] = useState<string | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [intRes, usageRes] = await Promise.allSettled([
          fetchAuth<{ integrations: Integration[] }>('/api/utilities/integrations'),
          fetchAuth<UsageData>('/api/utilities/usage'),
        ]);
        if (intRes.status === 'fulfilled') setIntegrations(intRes.value.integrations);
        if (usageRes.status === 'fulfilled') setUsage(usageRes.value);
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-jarvis-text-muted">
          <a href="/" className="hover:text-jarvis-accent transition-colors">Dashboard</a>
          <span>/</span>
          <span className="text-jarvis-text-primary">Utilities</span>
        </div>

        {/* Integration Health */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
          <h2 className="text-[15px] font-medium text-jarvis-text-primary mb-4">Integration Health</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-jarvis-border/50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {integrations.map((int) => (
                <div
                  key={int.sync_type}
                  className="group relative flex items-center gap-3 p-3 rounded-lg border border-jarvis-border/50 hover:border-jarvis-border transition-colors"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[int.status]} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-jarvis-text-primary truncate">{int.label}</p>
                    <p className="text-[11px] text-jarvis-text-dim">
                      {int.last_synced_at ? formatElapsed(int.elapsed_minutes) : 'Never synced'}
                      {int.events_synced != null && int.events_synced > 0 && ` · ${int.events_synced} items`}
                    </p>
                    {int.last_error && int.status !== 'ok' && (
                      <p className="text-[11px] text-jarvis-danger truncate" title={int.last_error}>
                        {int.last_error.slice(0, 60)}
                      </p>
                    )}
                  </div>
                  {int.description && (
                    <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 hidden group-hover:inline-block text-[10px] text-jarvis-text-dim bg-jarvis-bg border border-jarvis-border rounded px-2 py-1 whitespace-nowrap z-10 shadow-lg">
                      {int.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Usage */}
        {usage && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-medium text-jarvis-text-primary">API Usage</h2>
              <span className="text-xs text-jarvis-text-dim font-mono">{usage.billing_month}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-jarvis-text-muted border-b border-jarvis-border">
                    <th className="text-left py-1.5 font-normal">Service</th>
                    <th className="text-right py-1.5 font-normal">Calls</th>
                    <th className="text-right py-1.5 font-normal">Tokens In</th>
                    <th className="text-right py-1.5 font-normal">Tokens Out</th>
                    <th className="text-right py-1.5 font-normal">Chars</th>
                    <th className="text-right py-1.5 font-normal">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usage.services)
                    .filter(([svc, data]) => svc !== 'elevenlabs' && data.calls > 0)
                    .map(([svc, data]) => (
                    <tr key={svc} className="border-b border-jarvis-border/50">
                      <td className="py-2 text-jarvis-text-secondary">{SERVICE_LABELS[svc] || svc}</td>
                      <td className="py-2 text-right font-mono text-jarvis-text-primary">{data.calls.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono text-jarvis-text-dim">
                        {data.tokens_input > 0 ? data.tokens_input.toLocaleString() : '—'}
                      </td>
                      <td className="py-2 text-right font-mono text-jarvis-text-dim">
                        {data.tokens_output > 0 ? data.tokens_output.toLocaleString() : '—'}
                      </td>
                      <td className="py-2 text-right font-mono text-jarvis-text-dim">
                        {data.characters > 0 ? data.characters.toLocaleString() : '—'}
                      </td>
                      <td className="py-2 text-right font-mono text-jarvis-text-primary">
                        {data.estimated_cost_usd > 0 ? `$${data.estimated_cost_usd.toFixed(2)}` : '$0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ElevenLabs quota bar */}
            <div className="mt-4 p-3 rounded-lg border border-jarvis-border/50">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-jarvis-text-secondary">ElevenLabs Credits</span>
                  {usage.elevenlabs_quota.reset_at && (
                    <span className="text-[10px] text-jarvis-text-dim">
                      resets {new Date(usage.elevenlabs_quota.reset_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <span className={`font-mono ${usage.elevenlabs_quota.pct_used > 90 ? 'text-jarvis-danger' : usage.elevenlabs_quota.pct_used > 70 ? 'text-jarvis-warn' : 'text-jarvis-text-dim'}`}>
                  {usage.elevenlabs_quota.used.toLocaleString()} / {usage.elevenlabs_quota.limit.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-jarvis-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.elevenlabs_quota.pct_used > 90 ? 'bg-jarvis-danger' : usage.elevenlabs_quota.pct_used > 70 ? 'bg-jarvis-warn' : 'bg-jarvis-accent'
                  }`}
                  style={{ width: `${Math.min(100, usage.elevenlabs_quota.pct_used)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cost Summary */}
        {usage && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
            <h2 className="text-[15px] font-medium text-jarvis-text-primary mb-4">Monthly Cost Estimate</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Current month */}
              <div>
                <p className="text-[11px] text-jarvis-text-muted uppercase mb-2 font-medium">{usage.billing_month} (current)</p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  <div className="text-center">
                    <p className="text-base font-mono font-semibold text-jarvis-text-primary">
                      ${usage.cost_summary.variable_usd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-jarvis-text-dim uppercase">Variable</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-mono font-semibold text-jarvis-text-primary">
                      ${usage.cost_summary.fixed_usd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-jarvis-text-dim uppercase">Base</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-mono font-semibold text-jarvis-accent">
                      ${usage.cost_summary.total_estimated_usd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-jarvis-text-dim uppercase">Total</p>
                  </div>
                </div>
              </div>
              {/* Previous month */}
              {usage.prev_month && (
                <div className="border-t md:border-t-0 md:border-l border-jarvis-border/50 pt-4 md:pt-0 md:pl-6">
                  <p className="text-[11px] text-jarvis-text-muted uppercase mb-2 font-medium">{usage.prev_month.billing_month} (previous)</p>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                    <div className="text-center">
                      <p className="text-base font-mono font-semibold text-jarvis-text-dim">
                        ${usage.prev_month.cost_summary.variable_usd.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-jarvis-text-dim uppercase">Variable</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-mono font-semibold text-jarvis-text-dim">
                        ${usage.prev_month.cost_summary.fixed_usd.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-jarvis-text-dim uppercase">Base</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-mono font-semibold text-jarvis-text-dim">
                        ${usage.prev_month.cost_summary.total_estimated_usd.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-jarvis-text-dim uppercase">Total</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 text-[11px] text-jarvis-text-dim">
              {usage.cost_summary.base_costs
                ? Object.entries(usage.cost_summary.base_costs).map(([name, info], i) => (
                    <span key={name}>
                      {i > 0 && ' + '}
                      {name.charAt(0).toUpperCase() + name.slice(1)} ${info.amount}/mo
                      {info.type === 'usage-based' && <span className="text-jarvis-text-dim/60"> (usage-based)</span>}
                    </span>
                  ))
                : `Railway $${usage.cost_summary.fixed_breakdown.railway}/mo + ElevenLabs $${usage.cost_summary.fixed_breakdown.elevenlabs}/mo`
              }
            </div>
          </div>
        )}
        {/* Email Style Analysis */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-5">
          <h2 className="text-[15px] font-medium text-jarvis-text-primary mb-2">Email Style Analysis</h2>
          <p className="text-xs text-jarvis-text-dim mb-4">
            Fetch your recent sent emails from Outlook &amp; Gmail and analyze your communication style with Claude.
          </p>
          {!styleAnalysis ? (
            <button
              onClick={async () => {
                setStyleLoading(true);
                setStyleError(null);
                try {
                  const res = await fetchAuth<{ analysis: string; emailCount: number; errors?: string[] }>(
                    '/api/emails/style-analysis',
                  );
                  setStyleAnalysis(res.analysis);
                  if (res.errors?.length) setStyleError(`Warnings: ${res.errors.join(', ')}`);
                } catch (err) {
                  setStyleError(err instanceof Error ? err.message : 'Failed to analyze');
                } finally {
                  setStyleLoading(false);
                }
              }}
              disabled={styleLoading}
              className="px-4 py-2 text-sm rounded-lg bg-jarvis-accent text-white hover:bg-jarvis-accent/90 disabled:opacity-50 transition-colors"
            >
              {styleLoading ? 'Analyzing sent emails…' : 'Analyze My Email Style'}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setStyleAnalysis(null)}
                className="text-xs text-jarvis-accent hover:underline"
              >
                Run again
              </button>
              <div className="text-sm text-jarvis-text-secondary whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                {styleAnalysis}
              </div>
            </div>
          )}
          {styleError && (
            <p className="mt-2 text-xs text-jarvis-danger">{styleError}</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { fetchAuth } from '@/lib/fetchAuth';
import TopBar from '@/components/TopBar';

interface Integration {
  sync_type: string;
  label: string;
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

interface UsageData {
  billing_month: string;
  services: Record<string, ServiceUsage>;
  elevenlabs_quota: { used: number; limit: number; remaining: number; pct_used: number };
  cost_summary: {
    variable_usd: number;
    fixed_usd: number;
    fixed_breakdown: Record<string, number>;
    total_estimated_usd: number;
  };
}

const STATUS_DOT = {
  ok: 'bg-emerald-400',
  warning: 'bg-jarvis-warn',
  error: 'bg-red-400',
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
    <div className="min-h-screen bg-jarvis-bg flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-jarvis-text-muted">
          <a href="/" className="hover:text-jarvis-accent transition-colors">Dashboard</a>
          <span>/</span>
          <span className="text-jarvis-text-primary">Utilities</span>
        </div>

        {/* Integration Health */}
        <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
          <h2 className="text-sm font-semibold text-jarvis-text-primary mb-3">Integration Health</h2>
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
                  className="flex items-center gap-3 p-3 rounded-lg border border-jarvis-border/50 hover:border-jarvis-border transition-colors"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[int.status]} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-jarvis-text-primary truncate">{int.label}</p>
                    <p className="text-[10px] text-jarvis-text-dim">
                      {int.last_synced_at ? formatElapsed(int.elapsed_minutes) : 'Never synced'}
                      {int.events_synced != null && int.events_synced > 0 && ` · ${int.events_synced} items`}
                    </p>
                    {int.last_error && int.status !== 'ok' && (
                      <p className="text-[10px] text-red-400 truncate" title={int.last_error}>
                        {int.last_error.slice(0, 60)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Usage */}
        {usage && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-jarvis-text-primary">API Usage</h2>
              <span className="text-xs text-jarvis-text-dim font-mono">{usage.billing_month}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-jarvis-text-muted border-b border-jarvis-border">
                    <th className="text-left py-1 font-normal">Service</th>
                    <th className="text-right py-1 font-normal">Calls</th>
                    <th className="text-right py-1 font-normal">Tokens In</th>
                    <th className="text-right py-1 font-normal">Tokens Out</th>
                    <th className="text-right py-1 font-normal">Chars</th>
                    <th className="text-right py-1 font-normal">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usage.services).map(([svc, data]) => (
                    <tr key={svc} className="border-b border-jarvis-border/50">
                      <td className="py-1.5 text-jarvis-text-secondary">{SERVICE_LABELS[svc] || svc}</td>
                      <td className="py-1.5 text-right font-mono text-jarvis-text-primary">{data.calls.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-jarvis-text-dim">
                        {data.tokens_input > 0 ? data.tokens_input.toLocaleString() : '—'}
                      </td>
                      <td className="py-1.5 text-right font-mono text-jarvis-text-dim">
                        {data.tokens_output > 0 ? data.tokens_output.toLocaleString() : '—'}
                      </td>
                      <td className="py-1.5 text-right font-mono text-jarvis-text-dim">
                        {data.characters > 0 ? data.characters.toLocaleString() : '—'}
                      </td>
                      <td className="py-1.5 text-right font-mono text-jarvis-text-primary">
                        {data.estimated_cost_usd > 0 ? `$${data.estimated_cost_usd.toFixed(2)}` : '$0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ElevenLabs quota bar */}
            <div className="mt-4 p-3 rounded-lg border border-jarvis-border/50">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-jarvis-text-secondary">ElevenLabs Characters</span>
                <span className={`font-mono ${usage.elevenlabs_quota.pct_used > 90 ? 'text-red-400' : usage.elevenlabs_quota.pct_used > 70 ? 'text-jarvis-warn' : 'text-jarvis-text-dim'}`}>
                  {usage.elevenlabs_quota.used.toLocaleString()} / {usage.elevenlabs_quota.limit.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-jarvis-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.elevenlabs_quota.pct_used > 90 ? 'bg-red-400' : usage.elevenlabs_quota.pct_used > 70 ? 'bg-jarvis-warn' : 'bg-jarvis-accent'
                  }`}
                  style={{ width: `${Math.min(100, usage.elevenlabs_quota.pct_used)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cost Summary */}
        {usage && (
          <div className="rounded-xl border border-jarvis-border bg-jarvis-bg-card p-4">
            <h2 className="text-sm font-semibold text-jarvis-text-primary mb-3">Monthly Cost Estimate</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-lg font-mono font-semibold text-jarvis-text-primary">
                  ${usage.cost_summary.variable_usd.toFixed(2)}
                </p>
                <p className="text-[10px] text-jarvis-text-dim uppercase">Variable</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-mono font-semibold text-jarvis-text-primary">
                  ${usage.cost_summary.fixed_usd.toFixed(2)}
                </p>
                <p className="text-[10px] text-jarvis-text-dim uppercase">Fixed</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-mono font-semibold text-jarvis-accent">
                  ${usage.cost_summary.total_estimated_usd.toFixed(2)}
                </p>
                <p className="text-[10px] text-jarvis-text-dim uppercase">Total</p>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-jarvis-text-dim">
              Fixed: Railway ${usage.cost_summary.fixed_breakdown.railway}/mo + ElevenLabs ${usage.cost_summary.fixed_breakdown.elevenlabs}/mo
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Claude Sonnet 4 pricing (per million tokens)
const CLAUDE_INPUT_PRICE = 3; // $3/M input tokens
const CLAUDE_OUTPUT_PRICE = 15; // $15/M output tokens
// OpenAI TTS pricing
const OPENAI_TTS_PRICE_PER_M_CHARS = 15; // ~$15/M chars for tts-1-hd
// Monthly base costs
// Railway: usage-based Hobby plan, $5/mo minimum (actual may exceed)
// ElevenLabs: fixed subscription
const BASE_COSTS: Record<string, { amount: number; type: 'fixed' | 'usage-based' }> = {
  railway: { amount: 5, type: 'usage-based' },
  elevenlabs: { amount: 5, type: 'fixed' },
};

// Free-tier services excluded from the usage table (no variable cost)
const FREE_SERVICES = new Set(['garmin', 'google', 'microsoft', 'notion']);

type ServiceAgg = {
  calls: number;
  tokens_input: number;
  tokens_output: number;
  characters: number;
  estimated_cost_usd: number;
};

function aggregateUsage(rows: Record<string, unknown>[]): Record<string, ServiceAgg> {
  const services: Record<string, ServiceAgg> = {};
  for (const row of rows) {
    const svc = row.service as string;
    if (FREE_SERVICES.has(svc)) continue;
    if (!services[svc]) {
      services[svc] = { calls: 0, tokens_input: 0, tokens_output: 0, characters: 0, estimated_cost_usd: 0 };
    }
    services[svc].calls += (row.call_count as number) ?? 0;
    services[svc].tokens_input += (row.tokens_input as number) ?? 0;
    services[svc].tokens_output += (row.tokens_output as number) ?? 0;
    services[svc].characters += (row.characters_used as number) ?? 0;
  }
  for (const [svc, data] of Object.entries(services)) {
    if (svc === 'claude') {
      data.estimated_cost_usd = (data.tokens_input / 1_000_000) * CLAUDE_INPUT_PRICE
        + (data.tokens_output / 1_000_000) * CLAUDE_OUTPUT_PRICE;
    } else if (svc === 'openai') {
      data.estimated_cost_usd = (data.characters / 1_000_000) * OPENAI_TTS_PRICE_PER_M_CHARS;
    }
    data.estimated_cost_usd = Math.round(data.estimated_cost_usd * 100) / 100;
  }
  return services;
}

function buildCostSummary(services: Record<string, ServiceAgg>) {
  const totalVariable = Object.values(services).reduce((sum, s) => sum + s.estimated_cost_usd, 0);
  const totalBase = Object.values(BASE_COSTS).reduce((sum, c) => sum + c.amount, 0);
  const breakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(BASE_COSTS)) breakdown[k] = v.amount;
  return {
    variable_usd: Math.round(totalVariable * 100) / 100,
    fixed_usd: totalBase,
    fixed_breakdown: breakdown,
    base_costs: BASE_COSTS,
    total_estimated_usd: Math.round((totalVariable + totalBase) * 100) / 100,
  };
}

export const GET = withAuth(async () => {
  try {
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const monthStr = wibDate.toISOString().slice(0, 7);
    const monthStart = `${monthStr}-01`;
    const today = wibDate.toISOString().split('T')[0];

    // Previous month range
    const prevDate = new Date(wibDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthStr = prevDate.toISOString().slice(0, 7);
    const prevMonthStart = `${prevMonthStr}-01`;
    // Last day of prev month = day before current month start
    const prevMonthEnd = new Date(new Date(`${monthStart}T00:00:00Z`).getTime() - 86400000)
      .toISOString().split('T')[0];

    // Fetch current + previous month in parallel
    const [{ data: currentRows }, { data: prevRows }] = await Promise.all([
      supabase.from('api_usage_v2').select('*').gte('date', monthStart).lte('date', today),
      supabase.from('api_usage_v2').select('*').gte('date', prevMonthStart).lte('date', prevMonthEnd),
    ]);

    const services = aggregateUsage(currentRows || []);
    const prevServices = aggregateUsage(prevRows || []);

    // ElevenLabs quota — pull live from their API
    let elevenlabsQuota = { used: 0, limit: 40_000, remaining: 40_000, pct_used: 0, reset_at: '' };
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (elevenLabsKey) {
      try {
        const elRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
          headers: { 'xi-api-key': elevenLabsKey },
        });
        if (elRes.ok) {
          const sub = await elRes.json();
          const used = sub.character_count ?? 0;
          const limit = sub.character_limit ?? 40_000;
          const resetUnix = sub.next_character_count_reset_unix ?? 0;
          elevenlabsQuota = {
            used,
            limit,
            remaining: Math.max(0, limit - used),
            pct_used: limit > 0 ? Math.round((used / limit) * 100) : 0,
            reset_at: resetUnix ? new Date(resetUnix * 1000).toISOString() : '',
          };
        }
      } catch (e) {
        console.error('ElevenLabs subscription fetch failed:', e);
      }
    }

    return NextResponse.json({
      billing_month: monthStr,
      services,
      elevenlabs_quota: elevenlabsQuota,
      cost_summary: buildCostSummary(services),
      prev_month: {
        billing_month: prevMonthStr,
        services: prevServices,
        cost_summary: buildCostSummary(prevServices),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Usage API error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage', details: String(err) }, { status: 500 });
  }
});

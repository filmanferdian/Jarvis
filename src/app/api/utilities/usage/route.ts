import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Claude Sonnet 4 pricing (per million tokens)
const CLAUDE_INPUT_PRICE = 3; // $3/M input tokens
const CLAUDE_OUTPUT_PRICE = 15; // $15/M output tokens
// OpenAI TTS pricing
const OPENAI_TTS_PRICE_PER_M_CHARS = 15; // ~$15/M chars for tts-1-hd
// Fixed monthly costs
const FIXED_COSTS = {
  railway: 5,
  elevenlabs: 5,
};

export const GET = withAuth(async () => {
  try {
    // Get current month range
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const monthStr = wibDate.toISOString().slice(0, 7);
    const monthStart = `${monthStr}-01`;
    const today = wibDate.toISOString().split('T')[0];

    // Fetch all api_usage_v2 rows for current month
    const { data: usageRows } = await supabase
      .from('api_usage_v2')
      .select('*')
      .gte('date', monthStart)
      .lte('date', today);

    // Aggregate per service
    const services: Record<string, {
      calls: number;
      tokens_input: number;
      tokens_output: number;
      characters: number;
      estimated_cost_usd: number;
    }> = {};

    for (const row of usageRows || []) {
      const svc = row.service as string;
      if (!services[svc]) {
        services[svc] = { calls: 0, tokens_input: 0, tokens_output: 0, characters: 0, estimated_cost_usd: 0 };
      }
      services[svc].calls += row.call_count ?? 0;
      services[svc].tokens_input += row.tokens_input ?? 0;
      services[svc].tokens_output += row.tokens_output ?? 0;
      services[svc].characters += row.characters_used ?? 0;
    }

    // Calculate estimated costs
    for (const [svc, data] of Object.entries(services)) {
      if (svc === 'claude') {
        data.estimated_cost_usd = (data.tokens_input / 1_000_000) * CLAUDE_INPUT_PRICE
          + (data.tokens_output / 1_000_000) * CLAUDE_OUTPUT_PRICE;
      } else if (svc === 'openai') {
        data.estimated_cost_usd = (data.characters / 1_000_000) * OPENAI_TTS_PRICE_PER_M_CHARS;
      }
      // ElevenLabs, Google, Microsoft, Garmin, Notion: $0 variable
      data.estimated_cost_usd = Math.round(data.estimated_cost_usd * 100) / 100;
    }

    // ElevenLabs quota info
    const elevenLabsChars = services.elevenlabs?.characters ?? 0;
    const elevenLabsQuota = 30_000;

    const totalVariable = Object.values(services).reduce((sum, s) => sum + s.estimated_cost_usd, 0);
    const totalFixed = Object.values(FIXED_COSTS).reduce((sum, c) => sum + c, 0);

    return NextResponse.json({
      billing_month: monthStr,
      services,
      elevenlabs_quota: {
        used: elevenLabsChars,
        limit: elevenLabsQuota,
        remaining: Math.max(0, elevenLabsQuota - elevenLabsChars),
        pct_used: Math.round((elevenLabsChars / elevenLabsQuota) * 100),
      },
      cost_summary: {
        variable_usd: Math.round(totalVariable * 100) / 100,
        fixed_usd: totalFixed,
        fixed_breakdown: FIXED_COSTS,
        total_estimated_usd: Math.round((totalVariable + totalFixed) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Usage API error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage', details: String(err) }, { status: 500 });
  }
});

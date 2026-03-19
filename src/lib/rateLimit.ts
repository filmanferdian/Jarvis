import { supabase } from './supabase';

const DAILY_LIMIT = parseInt(process.env.JARVIS_DAILY_API_LIMIT || '50', 10);

function getWibToday(): string {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + wibOffset).toISOString().split('T')[0];
}

export async function checkRateLimit(): Promise<{
  allowed: boolean;
  callCount: number;
  limit: number;
  remaining: number;
  date: string;
}> {
  const today = getWibToday();

  const { data } = await supabase
    .from('api_usage')
    .select('call_count')
    .eq('date', today)
    .single();

  const callCount = data?.call_count ?? 0;
  const remaining = Math.max(0, DAILY_LIMIT - callCount);

  return {
    allowed: callCount < DAILY_LIMIT,
    callCount,
    limit: DAILY_LIMIT,
    remaining,
    date: today,
  };
}

export async function incrementUsage(): Promise<void> {
  const today = getWibToday();

  const { data } = await supabase
    .from('api_usage')
    .select('id, call_count')
    .eq('date', today)
    .single();

  if (data) {
    await supabase
      .from('api_usage')
      .update({ call_count: data.call_count + 1 })
      .eq('id', data.id);
  } else {
    await supabase
      .from('api_usage')
      .insert({ date: today, call_count: 1 });
  }
}

// --- Per-service usage tracking (api_usage_v2) ---

export async function trackServiceUsage(
  service: string,
  meta?: { tokens_input?: number; tokens_output?: number; characters?: number },
): Promise<void> {
  const today = getWibToday();

  const { data: existing } = await supabase
    .from('api_usage_v2')
    .select('id, call_count, tokens_input, tokens_output, characters_used')
    .eq('date', today)
    .eq('service', service)
    .single();

  if (existing) {
    await supabase
      .from('api_usage_v2')
      .update({
        call_count: existing.call_count + 1,
        tokens_input: (existing.tokens_input ?? 0) + (meta?.tokens_input ?? 0),
        tokens_output: (existing.tokens_output ?? 0) + (meta?.tokens_output ?? 0),
        characters_used: (existing.characters_used ?? 0) + (meta?.characters ?? 0),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('api_usage_v2').insert({
      date: today,
      service,
      call_count: 1,
      tokens_input: meta?.tokens_input ?? 0,
      tokens_output: meta?.tokens_output ?? 0,
      characters_used: meta?.characters ?? 0,
    });
  }
}

export async function getMonthlyServiceUsage(
  service: string,
  field: 'call_count' | 'characters_used' | 'tokens_input' | 'tokens_output' = 'call_count',
): Promise<number> {
  const today = getWibToday();
  const monthStart = today.slice(0, 7) + '-01'; // YYYY-MM-01

  const { data } = await supabase
    .from('api_usage_v2')
    .select(field)
    .eq('service', service)
    .gte('date', monthStart)
    .lte('date', today);

  if (!data) return 0;
  return data.reduce((sum, row) => sum + (((row as Record<string, unknown>)[field] as number) ?? 0), 0);
}

import { supabase } from './supabase';

const DAILY_LIMIT = parseInt(process.env.JARVIS_DAILY_API_LIMIT || '50', 10);

export async function checkRateLimit(): Promise<{
  allowed: boolean;
  callCount: number;
  limit: number;
  remaining: number;
  date: string;
}> {
  const today = new Date().toISOString().split('T')[0];

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
  const today = new Date().toISOString().split('T')[0];

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

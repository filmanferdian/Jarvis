import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage, trackServiceUsage } from '@/lib/rateLimit';
import { buildJarvisContext } from '@/lib/context';

function getWibToday(): string {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + wibOffset).toISOString().split('T')[0];
}

/** Format date as "5 Apr" */
function fmtDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

/** Compute weight trend summary from recent entries */
function computeWeightTrend(weights: Array<{ date: string; weight_kg: number | string }>): string {
  if (weights.length < 2) return 'Insufficient data for trend.';

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const oldVal = Number(oldest.weight_kg);
  const newVal = Number(newest.weight_kg);
  const diff = newVal - oldVal;
  const direction = diff > 0.3 ? 'UP' : diff < -0.3 ? 'DOWN' : 'STABLE';

  // Recent 3-entry trend
  const recent3 = sorted.slice(-3).map(w => `${fmtDate(w.date)}: ${Number(w.weight_kg).toFixed(1)}kg`);

  return `${direction} ${Math.abs(diff).toFixed(1)}kg over ${sorted.length} entries (${fmtDate(oldest.date)} to ${fmtDate(newest.date)}). Recent: ${recent3.join(' → ')}`;
}

// GET: Generate AI health insights based on recent data (cached daily)
export const GET = withAuth(async () => {
  try {
    const today = getWibToday();

    // Check cache first (insights are generated once per day)
    const { data: cached } = await supabase
      .from('briefing_cache')
      .select('baseline_snapshot')
      .eq('date', today)
      .single();

    const cachedInsights = (cached?.baseline_snapshot as Record<string, unknown>)?.health_insights as string | undefined;
    if (cachedInsights) {
      return NextResponse.json({ insights: cachedInsights, cached: true, date: today });
    }

    // Rate limit check
    const { allowed } = await checkRateLimit();
    if (!allowed) {
      return NextResponse.json({
        insights: 'Daily API limit reached. Health insights will be generated tomorrow.',
        cached: false,
        date: today,
      });
    }

    // Gather recent data for analysis — 30-day window for weight, 7-day for Garmin
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [garminRes, weightRes, measureRes, bloodRes, fitnessRes, okrRes] = await Promise.allSettled([
      supabase.from('garmin_daily').select('*').gte('date', sevenDaysAgo).order('date'),
      supabase.from('weight_log').select('*').gte('date', thirtyDaysAgo).order('date'),
      supabase.from('health_measurements').select('*').order('date', { ascending: false }).limit(15),
      supabase.from('blood_work').select('*').order('test_date', { ascending: false }).limit(10),
      supabase.from('fitness_context').select('current_week, current_phase').limit(1).single(),
      supabase.from('okr_targets').select('objective, key_result, target_value, unit, baseline_value').eq('is_active', true),
    ]);

    const garminDays = garminRes.status === 'fulfilled' ? garminRes.value.data || [] : [];
    const weights = weightRes.status === 'fulfilled' ? weightRes.value.data || [] : [];
    const measurements = measureRes.status === 'fulfilled' ? measureRes.value.data || [] : [];
    const bloodWork = bloodRes.status === 'fulfilled' ? bloodRes.value.data || [] : [];
    const fitness = fitnessRes.status === 'fulfilled' ? fitnessRes.value.data : null;
    const okrTargets = okrRes.status === 'fulfilled' ? okrRes.value.data || [] : [];

    // Build enriched data summary
    const garminSummary = garminDays.length > 0
      ? garminDays.map(d => `${d.date}: steps=${d.steps}, rhr=${d.resting_hr}, sleep_score=${d.sleep_score}, sleep_hrs=${d.sleep_duration_seconds ? (Number(d.sleep_duration_seconds) / 3600).toFixed(1) : '?'}, stress=${d.stress_level}, hrv=${d.hrv_7d_avg}, bb=${d.body_battery}, vo2=${d.vo2_max}`).join('\n')
      : 'No Garmin data available for the last 7 days.';

    const weightTrend = computeWeightTrend(weights);

    const weightSummary = weights.length > 0
      ? `30-day entries: ${weights.map(w => `${w.date}: ${Number(w.weight_kg).toFixed(1)}kg`).join(', ')}\nTREND: ${weightTrend}`
      : 'No weight data.';

    // Group measurements by type with date for staleness detection
    const measureSummary = measurements.length > 0
      ? measurements.map(m => `${m.measurement_type}=${m.value}${m.unit} (${fmtDate(m.date)})`).join(', ')
      : 'No body measurements recorded yet.';

    const bloodSummary = bloodWork.length > 0
      ? bloodWork.map(b => `${b.marker_name}=${b.value}${b.unit} (${fmtDate(b.test_date)})`).join(', ')
      : 'No blood work recorded.';

    const okrSummary = okrTargets.map(t =>
      `${t.objective}/${t.key_result}: target=${t.target_value}${t.unit}, baseline=${t.baseline_value ?? 'n/a'}`
    ).join('\n');

    const ctx = await buildJarvisContext({ pages: ['about_me'] });

    const apiKey = (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!;
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `${ctx.systemPrompt}

You are generating a weekly health check-in for a body transformation program. Write at the narrative level — lead with the "so what" interpretation, then back it with specific data. Don't just list numbers; explain what they mean for the program.

Be direct. Short sentences. Front-load the insight, not the data.

CONTEXT:
- ${fitness ? `Week ${fitness.current_week}, ${fitness.current_phase}` : 'Unknown week/phase'}
- Body composition is measured with a digital body-comp scale (BIA), not DEXA. These readings have ±2-3% variance and are best used for trends, not absolute values.
- Today's date: ${today}

OKR TARGETS:
${okrSummary}

LAST 7 DAYS GARMIN DATA:
${garminSummary}

WEIGHT (30 DAYS):
${weightSummary}

BODY MEASUREMENTS (with dates):
${measureSummary}

BLOOD WORK (with dates):
${bloodSummary}

Write exactly 3 sections. Use this format:

WHAT'S WORKING
- 2-3 bullets. Lead with the narrative insight ("Cardiovascular fitness is improving steadily"), then cite the supporting data ("VO2 max 37→39 over 2 weeks"). Only include things genuinely trending in the right direction.

NEEDS ATTENTION
- 2-3 bullets. Lead with the implication ("Weight gain is undermining the calorie deficit"), then cite the evidence ("113kg, up 2.7kg in 3 weeks"). Be honest about what the trend means for the program goals. Flag stale data (measurements older than 14 days from today's date) as needing a fresh reading.

FOCUS THIS WEEK
- 1-2 concrete, actionable items. Be specific about what to do and why it matters ("Weigh daily this week to confirm if the upward trend continues or if 113kg was a spike").

Rules:
- Each bullet: 1-2 sentences max. Lead with insight, back with data.
- Always compare recent trend (last 2-3 data points), not just baseline vs current.
- If weight is trending UP, say so clearly. Don't spin it as "down from baseline" when recent trajectory is upward.
- For BIA body composition data, note that single readings are noisy — focus on multi-week trends.
- Plain text only. No markdown, no bold, no headers beyond the 3 section names.`,
        }],
      }),
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const insights = claudeData.content?.[0]?.text || 'Unable to generate insights.';

    await incrementUsage();
    await trackServiceUsage('claude', {
      tokens_input: claudeData.usage?.input_tokens ?? 0,
      tokens_output: claudeData.usage?.output_tokens ?? 0,
    });

    // Cache insights in baseline_snapshot
    const existingSnapshot = (cached?.baseline_snapshot as Record<string, unknown>) || {};
    await supabase.from('briefing_cache').upsert(
      {
        date: today,
        baseline_snapshot: { ...existingSnapshot, health_insights: insights },
      },
      { onConflict: 'date' },
    );

    return NextResponse.json({ insights, cached: false, date: today });
  } catch (err) {
    console.error('Health insights error:', err);
    return NextResponse.json(
      { error: 'Failed to generate insights', details: String(err) },
      { status: 500 },
    );
  }
});

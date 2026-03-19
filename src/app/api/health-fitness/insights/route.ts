import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage, trackServiceUsage } from '@/lib/rateLimit';

function getWibToday(): string {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + wibOffset).toISOString().split('T')[0];
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

    // Gather recent data for analysis
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [garminRes, weightRes, measureRes, bloodRes, fitnessRes, okrRes] = await Promise.allSettled([
      supabase.from('garmin_daily').select('*').gte('date', sevenDaysAgo).order('date'),
      supabase.from('weight_log').select('*').gte('date', sevenDaysAgo).order('date'),
      supabase.from('health_measurements').select('*').order('date', { ascending: false }).limit(10),
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

    // Build data summary for Claude
    const garminSummary = garminDays.length > 0
      ? garminDays.map(d => `${d.date}: steps=${d.steps}, rhr=${d.resting_hr}, sleep=${d.sleep_score}, stress=${d.stress_level}, hrv=${d.hrv_7d_avg}, bb=${d.body_battery}, vo2=${d.vo2_max}`).join('\n')
      : 'No Garmin data available for the last 7 days.';

    const weightSummary = weights.length > 0
      ? weights.map(w => `${w.date}: ${w.weight_kg}kg`).join(', ')
      : 'No weight data.';

    const measureSummary = measurements.length > 0
      ? measurements.map(m => `${m.date}: ${m.measurement_type}=${m.value}${m.unit}`).join(', ')
      : 'No body measurements recorded yet.';

    const bloodSummary = bloodWork.length > 0
      ? bloodWork.map(b => `${b.test_date}: ${b.marker_name}=${b.value}${b.unit}`).join(', ')
      : 'No blood work recorded. Next due: quarterly Prodia HL II panel.';

    const okrSummary = okrTargets.map(t =>
      `${t.objective}/${t.key_result}: target=${t.target_value}${t.unit}, baseline=${t.baseline_value ?? 'n/a'}`
    ).join('\n');

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
        max_tokens: 400,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `You are a health analytics assistant for Filman Ferdian's transformation program. Analyze the following 7-day health data and provide a concise executive summary.

CURRENT CONTEXT:
${fitness ? `Week ${fitness.current_week}, ${fitness.current_phase}` : 'Unknown week/phase'}

OKR TARGETS:
${okrSummary}

LAST 7 DAYS GARMIN DATA:
${garminSummary}

WEIGHT TREND:
${weightSummary}

BODY MEASUREMENTS:
${measureSummary}

BLOOD WORK:
${bloodSummary}

Generate 4-6 bullet points. Each should be actionable or insightful. Include:
- Trend observations (improving/declining/stable)
- Progress toward OKR targets (on track / behind / at risk)
- Stale data warnings (metrics not measured recently)
- Upcoming reminders (blood work due, measurements overdue)

Keep each bullet under 20 words. Use plain text, no markdown. Start each bullet with a status indicator: ✓ (on track), ⚠ (needs attention), ✗ (off track), → (trend observation).`,
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

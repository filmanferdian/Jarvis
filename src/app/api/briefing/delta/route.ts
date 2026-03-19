import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage, trackServiceUsage } from '@/lib/rateLimit';

function getWibToday(): string {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + wibOffset).toISOString().split('T')[0];
}

// POST: Generate delta briefing (what changed since morning)
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const today = getWibToday();

    // Get morning baseline
    const { data: cached } = await supabase
      .from('briefing_cache')
      .select('baseline_snapshot, briefing_text')
      .eq('date', today)
      .single();

    if (!cached?.baseline_snapshot) {
      return NextResponse.json({
        delta: 'No morning briefing baseline found for today. Generate a morning briefing first.',
        has_changes: false,
      });
    }

    const baseline = cached.baseline_snapshot as {
      calendar_count?: number;
      task_count?: number;
      email_count?: number;
    };

    // Fetch current state
    const [calRes, taskRes, emailRes] = await Promise.allSettled([
      supabase.from('calendar_events').select('id').eq('date', today),
      supabase.from('notion_tasks').select('id').eq('status', 'In Progress'),
      supabase.from('email_synthesis').select('id').eq('date', today),
    ]);

    const currentCalendar = calRes.status === 'fulfilled' ? calRes.value.data?.length ?? 0 : 0;
    const currentTasks = taskRes.status === 'fulfilled' ? taskRes.value.data?.length ?? 0 : 0;
    const currentEmails = emailRes.status === 'fulfilled' ? emailRes.value.data?.length ?? 0 : 0;

    const changes: string[] = [];
    if (currentCalendar !== (baseline.calendar_count ?? 0)) {
      const diff = currentCalendar - (baseline.calendar_count ?? 0);
      changes.push(`${diff > 0 ? '+' : ''}${diff} calendar event(s)`);
    }
    if (currentTasks !== (baseline.task_count ?? 0)) {
      const diff = currentTasks - (baseline.task_count ?? 0);
      changes.push(`${diff > 0 ? '+' : ''}${diff} active task(s)`);
    }
    if (currentEmails !== (baseline.email_count ?? 0)) {
      const diff = currentEmails - (baseline.email_count ?? 0);
      changes.push(`${diff > 0 ? '+' : ''}${diff} email digest(s)`);
    }

    if (changes.length === 0) {
      return NextResponse.json({
        delta: 'No significant changes since this morning\'s briefing.',
        has_changes: false,
      });
    }

    // Rate limit check
    const { allowed } = await checkRateLimit();
    if (!allowed) {
      return NextResponse.json({
        delta: `Changes detected: ${changes.join(', ')}. Daily API limit reached — cannot generate detailed summary.`,
        has_changes: true,
        changes,
      });
    }

    // Generate delta with Claude
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
        max_tokens: 300,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `You are Jarvis, a British butler-style AI assistant. Provide a brief mid-day update. Changes since morning: ${changes.join(', ')}. Keep it under 100 words, conversational, mention "Mr. Ferdian" once. Focus on what's actionable.`,
        }],
      }),
    });

    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    await incrementUsage();
    await trackServiceUsage('claude', {
      tokens_input: claudeData.usage?.input_tokens ?? 0,
      tokens_output: claudeData.usage?.output_tokens ?? 0,
    });

    const delta = claudeData.content?.[0]?.text || `Changes: ${changes.join(', ')}`;

    return NextResponse.json({
      delta,
      has_changes: true,
      changes,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Delta briefing error:', err);
    return NextResponse.json(
      { error: 'Failed to generate delta', details: String(err) },
      { status: 500 },
    );
  }
});

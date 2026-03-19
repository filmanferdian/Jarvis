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
      .select('baseline_snapshot, briefing_text, generated_at')
      .eq('date', today)
      .single();

    if (!cached?.baseline_snapshot) {
      return NextResponse.json({
        delta: 'No morning briefing baseline found for today. Generate a morning briefing first.',
        has_changes: false,
        type: 'delta',
      });
    }

    const baseline = cached.baseline_snapshot as {
      calendar_count?: number;
      task_count?: number;
      email_count?: number;
      calendar_ids?: string[];
      task_ids?: string[];
      email_ids?: string[];
    };

    const morningTime = cached.generated_at || `${today}T00:00:00Z`;

    // Fetch current items with details (not just counts)
    const [calRes, taskRes, emailRes] = await Promise.allSettled([
      supabase.from('calendar_events')
        .select('id, title, start_time, source')
        .eq('date', today),
      supabase.from('notion_tasks')
        .select('id, title, status, priority')
        .in('status', ['In Progress', 'Not Started', 'To Do']),
      supabase.from('email_synthesis')
        .select('id, subject, sender, priority_label')
        .eq('date', today),
    ]);

    const currentCalendar = calRes.status === 'fulfilled' ? calRes.value.data || [] : [];
    const currentTasks = taskRes.status === 'fulfilled' ? taskRes.value.data || [] : [];
    const currentEmails = emailRes.status === 'fulfilled' ? emailRes.value.data || [] : [];

    // Find NEW items (not in baseline)
    const baselineCalIds = new Set(baseline.calendar_ids || []);
    const baselineTaskIds = new Set(baseline.task_ids || []);
    const baselineEmailIds = new Set(baseline.email_ids || []);

    const newCalendar = currentCalendar.filter(e => !baselineCalIds.has(e.id));
    const newTasks = currentTasks.filter(t => !baselineTaskIds.has(t.id));
    const newEmails = currentEmails.filter(e => !baselineEmailIds.has(e.id));

    // Also detect removed items
    const removedCalCount = Math.max(0, (baseline.calendar_count ?? 0) - currentCalendar.length + newCalendar.length);
    const removedTaskCount = Math.max(0, (baseline.task_count ?? 0) - currentTasks.length + newTasks.length);

    const hasChanges = newCalendar.length > 0 || newTasks.length > 0 || newEmails.length > 0 || removedCalCount > 0 || removedTaskCount > 0;

    if (!hasChanges) {
      return NextResponse.json({
        delta: 'No changes since this morning\'s briefing, sir. Your day is proceeding as planned.',
        has_changes: false,
        type: 'delta',
        since: morningTime,
      });
    }

    // Build specific change descriptions
    const changeDetails: string[] = [];

    if (newCalendar.length > 0) {
      const items = newCalendar.map(e => `"${e.title}" at ${e.start_time || 'TBD'}`).join('; ');
      changeDetails.push(`${newCalendar.length} new calendar event(s): ${items}`);
    }
    if (removedCalCount > 0) {
      changeDetails.push(`${removedCalCount} calendar event(s) cancelled or removed`);
    }
    if (newTasks.length > 0) {
      const items = newTasks.map(t => `"${t.title}" (${t.priority || 'normal'})`).join('; ');
      changeDetails.push(`${newTasks.length} new task(s): ${items}`);
    }
    if (removedTaskCount > 0) {
      changeDetails.push(`${removedTaskCount} task(s) completed or removed`);
    }
    if (newEmails.length > 0) {
      const items = newEmails.map(e => `"${e.subject}" from ${e.sender || 'unknown'}${e.priority_label ? ` [${e.priority_label}]` : ''}`).join('; ');
      changeDetails.push(`${newEmails.length} new email(s): ${items}`);
    }

    // Rate limit check
    const { allowed } = await checkRateLimit();
    if (!allowed) {
      return NextResponse.json({
        delta: `Since this morning: ${changeDetails.join('. ')}. Daily API limit reached — cannot generate detailed summary.`,
        has_changes: true,
        type: 'delta',
        changes: changeDetails,
        since: morningTime,
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
        max_tokens: 400,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `You are Jarvis, a British butler-style AI assistant. Provide a mid-day update for Mr. Ferdian.

Since this morning's briefing, the following has changed:
${changeDetails.map(c => `- ${c}`).join('\n')}

Write a concise update (under 150 words) that:
1. Opens with "Since this morning, sir..." or similar butler phrasing
2. Lists the specific new items he needs to address
3. Highlights anything urgent or time-sensitive
4. Ends with a brief recommendation on what to tackle next
5. Keep the Alfred/butler tone — warm, composed, protective`,
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

    const delta = claudeData.content?.[0]?.text || `Since this morning: ${changeDetails.join('. ')}`;

    return NextResponse.json({
      delta,
      has_changes: true,
      type: 'delta',
      changes: changeDetails,
      new_items: {
        calendar: newCalendar.length,
        tasks: newTasks.length,
        emails: newEmails.length,
      },
      since: morningTime,
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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';

// POST: Regenerate today's morning briefing using real calendar + tasks data
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', usage },
        { status: 429 }
      );
    }

    // Use WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    // End of this week (Sunday)
    const dayOfWeek = wibDate.getDay();
    const endOfWeek = new Date(wibDate);
    endOfWeek.setDate(wibDate.getDate() + (7 - dayOfWeek));
    const weekEnd = endOfWeek.toISOString().split('T')[0];

    // Fetch calendar events for today
    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .order('start_time', { ascending: true });

    // Fetch tasks due this week
    const { data: tasks } = await supabase
      .from('notion_tasks')
      .select('*')
      .lte('due_date', weekEnd)
      .not('status', 'in', '("Done","Archived")')
      .order('due_date', { ascending: true });

    // Fetch today's email synthesis if available
    const { data: emailData } = await supabase
      .from('email_synthesis')
      .select('synthesis_text')
      .eq('date', today)
      .single();

    // Build prompt sections
    const calendarSection =
      events && events.length > 0
        ? events
            .map((e) => {
              const start = new Date(e.start_time).toLocaleTimeString(
                'en-US',
                { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }
              );
              const end = e.end_time
                ? new Date(e.end_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Jakarta',
                  })
                : '';
              return `- ${start}${end ? `–${end}` : ''}: ${e.title}`;
            })
            .join('\n')
        : 'No calendar events today.';

    const tasksSection =
      tasks && tasks.length > 0
        ? tasks
            .map(
              (t) =>
                `- [${t.status}] ${t.name}${t.priority ? ` (${t.priority})` : ''}${t.due_date ? ` — due ${t.due_date}` : ''}`
            )
            .join('\n')
        : 'No tasks due this week.';

    const emailSection = emailData?.synthesis_text
      ? `Email summary: ${emailData.synthesis_text}`
      : 'No email synthesis available.';

    const dateSummary = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    const prompt = `You are Jarvis — a refined, composed British AI butler, modeled after the AI assistant from Iron Man. You serve one person: Filman, whom you address as "sir."

Speak in natural, flowing sentences as if reading aloud. No markdown, no bullet points, no numbered lists, no asterisks, no headers. Use declarative sentences with natural pauses. Be formal yet warm, occasionally dry-witted.

Target exactly 450 words (approximately 3 minutes when spoken aloud).

Structure your briefing as a single flowing narrative:
- Open with a brief greeting acknowledging the day and date
- Summarize today's schedule conversationally
- Transition to key priorities and tasks that need attention
- Flag any alerts, overdue items, or conflicts
- Close with a focused recommendation for the day

Example opening: "Good morning, sir. It is ${dateSummary}, and you have a rather full slate ahead of you."

--- TODAY'S CALENDAR ---
${calendarSection}

--- TASKS THIS WEEK ---
${tasksSection}

--- EMAIL DIGEST ---
${emailSection}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const briefingText =
      claudeData.content?.[0]?.text || 'Unable to generate briefing';

    const dataSources = {
      calendar: !!(events && events.length > 0),
      notion_tasks: !!(tasks && tasks.length > 0),
      email: !!emailData?.synthesis_text,
    };

    // Upsert to briefing_cache
    const { error: dbError } = await supabase.from('briefing_cache').upsert(
      {
        date: today,
        briefing_text: briefingText,
        generated_at: new Date().toISOString(),
        data_sources_used: dataSources,
      },
      { onConflict: 'date' }
    );

    if (dbError) throw dbError;

    await incrementUsage();

    return NextResponse.json({
      date: today,
      briefing: briefingText,
      generatedAt: new Date().toISOString(),
      dataSources,
    });
  } catch (err) {
    console.error('[API Error] Failed to regenerate briefing:', err);
    return NextResponse.json(
      { error: 'Failed to regenerate briefing' },
      { status: 500 }
    );
  }
});

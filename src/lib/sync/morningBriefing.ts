import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';

export interface BriefingResult {
  date: string;
  briefing: string;
  generatedAt: string;
  dataSources: { calendar: boolean; notion_tasks: boolean; email: boolean };
}

export async function generateBriefing(): Promise<BriefingResult> {
  const usage = await checkRateLimit();
  if (!usage.allowed) {
    throw new Error('Daily API limit reached');
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

  const prompt = `You are Jarvis — a refined British butler and chief of staff to Filman Ferdian ("Mr. Ferdian"). Generate a concise morning briefing for ${dateSummary}.

Use these numbered sections:
1. Calendar overview: Summarize today's schedule
2. Tasks & priorities: Highlight what needs attention this week
3. Alerts: Flag anything overdue, conflicting, or urgent
4. Recommended focus: Suggest top priority for today

Keep it concise and actionable. Under 300 words total. Warm but composed tone — like Alfred Pennyworth briefing Bruce Wayne.

--- TODAY'S CALENDAR ---
${calendarSection}

--- TASKS THIS WEEK ---
${tasksSection}

--- EMAIL DIGEST ---
${emailSection}`;

  const anthropicKey = (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!;
  if (!anthropicKey) throw new Error('JARVIS_ANTHROPIC_KEY not configured');

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const claudeData = await claudeRes.json();
  const briefingText = claudeData.content?.[0]?.text || 'Unable to generate briefing';

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

  return {
    date: today,
    briefing: briefingText,
    generatedAt: new Date().toISOString(),
    dataSources,
  };
}

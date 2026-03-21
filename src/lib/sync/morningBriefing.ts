import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';
import { buildJarvisContext, allPages } from '@/lib/context';
import { generateAndStoreAudio, cleanupOldDeltas } from '@/lib/tts';

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

  const ctx = await buildJarvisContext({ pages: allPages() });

  const prompt = `${ctx.systemPrompt}

Generate a morning briefing for ${dateSummary}.

VOICE AND TONE:
Warm but composed, like a trusted advisor briefing you at the start of the day. Direct, personal, conversational. Short sentences. No corporate speak, no AI-sounding language.

STRUCTURE:
Use markdown formatting. Section labels should be **bold** on their own line. Use bullet points (- ) or numbered lists where appropriate. Separate each section with one blank line.

**Calendar Overview**
Summarize today's schedule. Note any back-to-back meetings or gaps.

**Tasks and Priorities**
Highlight what needs attention this week. Call out anything overdue or due soon. Use a numbered list for actionable items.

**Alerts**
Flag anything overdue, conflicting, or urgent. Skip this section entirely if there is nothing to flag.

**Recommended Focus**
Suggest the top priority for today based on deadlines, calendar, and urgency.

FORMATTING RULES:
- Use markdown: **bold** for section labels, bullet points, numbered lists.
- No emdashes. Use commas or periods instead.
- Separate each section with one blank line for readability.
- Mix flowing paragraphs with bullet/numbered lists as appropriate.
- Under 500 words total for the written briefing.

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
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const claudeData = await claudeRes.json();
  const fullText = claudeData.content?.[0]?.text || 'Unable to generate briefing';

  const briefingText = fullText;

  // Track Claude API usage
  try {
    const { trackServiceUsage } = await import('@/lib/rateLimit');
    await trackServiceUsage('claude', {
      tokens_input: claudeData.usage?.input_tokens ?? 0,
      tokens_output: claudeData.usage?.output_tokens ?? 0,
    });
  } catch { /* non-critical */ }

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

  // Pre-generate TTS audio and store in Supabase Storage
  try {
    const audioUrl = await generateAndStoreAudio(briefingText, today);
    if (audioUrl) {
      await supabase
        .from('briefing_cache')
        .update({ audio_url: audioUrl })
        .eq('date', today);
      console.log(`[morning-briefing] Audio pre-generated for ${today}`);
    }
  } catch (audioErr) {
    console.error('[morning-briefing] Audio pre-generation failed (non-critical):', audioErr);
  }

  // Clean up old delta recordings and records from previous days
  await cleanupOldDeltas(today);

  return {
    date: today,
    briefing: briefingText,
    generatedAt: new Date().toISOString(),
    dataSources,
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';
import { VoiceIntentSchema } from '@/lib/validation';
import { safeError } from '@/lib/errors';

// POST: Parse voice transcript into intent + generate response
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', usage },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = VoiceIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { transcript } = parsed.data;

    const prompt = `You are Jarvis, a personal executive assistant (think Iron Man's Jarvis — professional, warm, concise, dry wit).

The user just spoke to you. Parse their intent and respond.

Respond with valid JSON only:
{
  "intent": "one of: add_task, check_schedule, briefing_summary, check_tasks, general_question, unknown",
  "response": "Your spoken response to the user (1-2 sentences, conversational)",
  "action": {
    "type": "the intent type",
    "params": { ... any extracted parameters like task_name, date, priority ... }
  }
}

User said: "${transcript}"`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{}';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    let intentParsed;
    try {
      intentParsed = JSON.parse(jsonMatch?.[0] || '{}');
    } catch {
      intentParsed = {
        intent: 'unknown',
        response: "I didn't quite catch that. Could you try again?",
        action: { type: 'unknown', params: {} },
      };
    }

    // Log to voice_log table
    await supabase.from('voice_log').insert({
      transcript,
      intent: intentParsed.intent,
      action_taken: JSON.stringify(intentParsed.action),
      response_text: intentParsed.response,
    });

    await incrementUsage();

    return NextResponse.json({
      intent: intentParsed.intent,
      response: intentParsed.response,
      action: intentParsed.action,
    });
  } catch (err) {
    return safeError('Failed to process voice input', err);
  }
});

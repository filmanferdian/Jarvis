import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';

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

    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'transcript is required' },
        { status: 400 }
      );
    }

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
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
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
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch?.[0] || '{}');
    } catch {
      parsed = {
        intent: 'unknown',
        response: "I didn't quite catch that. Could you try again?",
        action: { type: 'unknown', params: {} },
      };
    }

    // Log to voice_log table
    await supabase.from('voice_log').insert({
      transcript,
      intent: parsed.intent,
      action_taken: JSON.stringify(parsed.action),
      response_text: parsed.response,
    });

    await incrementUsage();

    return NextResponse.json({
      intent: parsed.intent,
      response: parsed.response,
      action: parsed.action,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to process voice input', details: String(err) },
      { status: 500 }
    );
  }
});

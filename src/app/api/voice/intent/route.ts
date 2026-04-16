import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';
import { VoiceIntentSchema } from '@/lib/validation';
import { safeError } from '@/lib/errors';
import { buildJarvisContext, allPages } from '@/lib/context';
import { sanitizeMultiline, wrapUntrusted, UNTRUSTED_PREAMBLE } from '@/lib/promptEscape';

async function getFitnessContext(): Promise<string> {
  try {
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const dayName = wibDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Jakarta' }).toLowerCase();

    const { data: ctx } = await supabase
      .from('fitness_context')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    if (!ctx) return '';

    const trainingMap = ctx.training_day_map as Record<string, Record<string, unknown>>;
    const cardioMap = ctx.cardio_schedule as Record<string, string>;
    const todayTraining = trainingMap[dayName];
    const todayCardio = cardioMap[dayName];
    const isTrainingDay = todayTraining && todayTraining.type !== 'Rest';
    const macros = (isTrainingDay ? ctx.macro_training : ctx.macro_rest) as { calories: number; protein: number; carbs: number; fat: number };
    const eatingWindow = ctx.eating_window as { open: string; close: string; pre_workout?: string } | null;

    const exercises = isTrainingDay && todayTraining.exercises
      ? (todayTraining.exercises as Array<{ name: string; sets: number; reps: string }>)
          .map((e) => `${e.name}: ${e.sets}x${e.reps}`)
          .join(', ')
      : '';

    return [
      `Week ${ctx.current_week}, ${ctx.current_phase}.`,
      `Today (${dayName}): ${isTrainingDay ? todayTraining.type : 'Rest day'}.`,
      todayCardio ? `Cardio: ${todayCardio}.` : '',
      exercises ? `Exercises: ${exercises}.` : '',
      `Macros (${isTrainingDay ? 'training' : 'rest'} day): ${macros.calories} cal, ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat.`,
      eatingWindow ? `Eating window: ${eatingWindow.open} to ${eatingWindow.close}.` : '',
      ctx.next_deload_week ? `Next deload: Week ${ctx.next_deload_week}.` : '',
      ctx.special_notes || '',
    ].filter(Boolean).join(' ');
  } catch {
    return '';
  }
}

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

    // Check if fitness-related intent
    const fitnessKeywords = ['workout', 'exercise', 'training', 'macros', 'calories', 'protein', 'cardio', 'deload', 'fitness', 'gym', 'run', 'walk', 'eating window', 'meal', 'phase', 'week'];
    const isFitnessQuery = fitnessKeywords.some((kw) => transcript.toLowerCase().includes(kw));

    let fitnessContext = '';
    if (isFitnessQuery) {
      fitnessContext = await getFitnessContext();
    }

    const ctx = await buildJarvisContext({ pages: allPages() });

    const safeTranscript = sanitizeMultiline(transcript, 5000);

    const prompt = `${ctx.systemPrompt}

${UNTRUSTED_PREAMBLE}

The user just spoke to you. Parse their intent and respond.

Respond with valid JSON only:
{
  "intent": "one of: add_task, check_schedule, briefing_summary, check_tasks, check_workout, check_macros, check_cardio, check_fitness_progress, general_question, unknown",
  "response": "Your spoken response to the user (1-3 sentences, conversational, specific)",
  "action": {
    "type": "the intent type",
    "params": { ... any extracted parameters like task_name, date, priority ... }
  }
}

Intent descriptions:
- check_workout: User asks about today's workout, exercises, training
- check_macros: User asks about calorie or macro targets
- check_cardio: User asks about today's cardio session
- check_fitness_progress: User asks about current week, phase, deload, or overall progress

${fitnessContext ? `--- FITNESS CONTEXT ---\n${fitnessContext}` : ''}

${wrapUntrusted('untrusted_user_transcript', safeTranscript)}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
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

    // Track Claude API usage
    try {
      const { trackServiceUsage } = await import('@/lib/rateLimit');
      await trackServiceUsage('claude', {
        tokens_input: claudeData.usage?.input_tokens ?? 0,
        tokens_output: claudeData.usage?.output_tokens ?? 0,
      });
    } catch { /* non-critical */ }

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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rateLimit';
import { safeError } from '@/lib/errors';

// POST /api/quran/synthesis
// Generates the daily Quran reading synthesis for the Ubayy reader, on demand.
// Auth: withAuth (JARVIS_AUTH_TOKEN via Bearer header). Result cached per (user, date)
// in quran_synthesis so the briefing and the 15:30 callback can reuse the same text.

const AyahSchema = z.object({
  key: z.string().max(12),
  arabic: z.string().max(4000),
  translation: z.string().max(4000),
});

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  surah: z.number().int().min(1).max(114),
  range: z.string().max(120),
  ayahs: z.array(AyahSchema).min(1).max(60),
  regenerate: z.boolean().optional(),
});

const USER_ID = 'filman';
const MODEL = 'claude-sonnet-4-5';

function buildPrompt(range: string, ayahs: z.infer<typeof AyahSchema>[]): string {
  const passage = ayahs
    .map((a) => `${a.key}  ${a.arabic}\n    ${a.translation}`)
    .join('\n');

  return `You are a careful Sunni Quran study companion writing a daily reading synthesis for a personal reader. Today's portion is ${range}.

Write a synthesis of about 1000 to 1100 words in English (a five-minute read), grounded in classical Sunni tafsir. Draw on Tafsir Ibn Kathir, Maarif-ul-Quran (Mufti Shafi), Tafsir Al-Azhar (Hamka), and Tafsir al-Tabari, and cite authentic hadith from Sahih al-Bukhari and Sahih Muslim where directly relevant. Stay within mainstream Sunni orthodoxy; do not introduce sectarian or speculative readings.

Use these markdown section headings exactly, in this order:

## Overview
One paragraph: what this portion covers and its place in the surah.

## Historical context
Asbab al-nuzul and the historical setting. Longer if the portion opens a new theme, brief if it continues one.

## Meaning
Walk through the portion by grouping the verses into a few thematic clusters, not strictly one verse at a time. For each cluster, paraphrase briefly, then explain it, naming the tafsir you draw on (for example, "Maarif-ul-Quran reads...", "Ibn Kathir gathers..."). Keep this section tight so the whole piece stays within the length limit.

## Key terms
3 to 6 bullets. Each: the Arabic term in Arabic script, its transliteration in parentheses, then a short gloss of its meaning in this context.

## Cross-references
2 to 4 bullets linking verses in this portion to related verses elsewhere in the Quran, each with a one-line note on the connection.

## Sources
A bullet list of the tafsir and hadith works you actually drew on.

Formatting rules:
- Markdown headings and bullets only. Bold sparingly.
- No em-dashes anywhere; use commas, periods, or parentheses instead.
- Reverent, precise, scholarly tone. No filler, no preamble, no closing summary line.
- Length is a firm limit: about 1000 words total, never more than 1100 (a five-minute read). Hold these rough per-section budgets so the whole piece fits and always finishes: Overview about 80 words, Historical context about 150, Meaning about 450 (cluster verses to stay within this), Key terms about 120, Cross-references about 100, Sources a short list. Completing all six sections matters more than depth in any one; never stop mid-sentence or omit the Sources section.

The portion text (Uthmani Arabic with Saheeh International translation):

${passage}`;
}

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json({ error: 'Daily API limit reached', usage }, { status: 429 });
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
    }
    const { date, surah, range, ayahs, regenerate } = parsed.data;

    // Cache hit (unless an explicit regenerate was requested)
    if (!regenerate) {
      const { data: cached } = await supabase
        .from('quran_synthesis')
        .select('synthesis, created_at')
        .eq('user_id', USER_ID)
        .eq('date', date)
        .maybeSingle();
      if (cached?.synthesis) {
        return NextResponse.json({ date, surah, range, synthesis: cached.synthesis, cached: true, generatedAt: cached.created_at });
      }
    }

    const anthropicKey = process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: 'Claude key not configured' }, { status: 500 });
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.4,
        messages: [{ role: 'user', content: buildPrompt(range, ayahs) }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const synthesis: string = (claudeData.content?.[0]?.text || '').trim();
    if (!synthesis) throw new Error('Empty synthesis from Claude');

    await supabase
      .from('quran_synthesis')
      .upsert({ user_id: USER_ID, date, surah, range, synthesis, model: MODEL }, { onConflict: 'user_id,date' });

    // Best-effort usage accounting (mirrors the briefing route)
    try {
      const { trackServiceUsage, incrementUsage } = await import('@/lib/rateLimit');
      await trackServiceUsage('claude', {
        tokens_input: claudeData.usage?.input_tokens ?? 0,
        tokens_output: claudeData.usage?.output_tokens ?? 0,
      });
      await incrementUsage();
    } catch {
      // usage tracking is non-critical
    }

    return NextResponse.json({ date, surah, range, synthesis, cached: false, generatedAt: new Date().toISOString() });
  } catch (e) {
    return safeError('Failed to generate Quran synthesis', e);
  }
});

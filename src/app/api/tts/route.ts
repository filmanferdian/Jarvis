import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';
import { TtsSchema } from '@/lib/validation';
import { safeError } from '@/lib/errors';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = TtsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { text } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Rate limit check (shares daily quota with other Claude/AI calls)
    const { allowed, remaining } = await checkRateLimit();
    if (!allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', remaining },
        { status: 429 }
      );
    }

    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: 'fable',
        speed: 0.95,
        input: text,
        response_format: 'mp3',
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      throw new Error(`OpenAI TTS error: ${ttsRes.status} ${err}`);
    }

    await incrementUsage();

    const audioBuffer = await ttsRes.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    return safeError('TTS generation failed', err);
  }
});

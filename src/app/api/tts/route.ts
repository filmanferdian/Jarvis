import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';

const MAX_TEXT_LENGTH = 4096;

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text too long (max ${MAX_TEXT_LENGTH} chars)` },
        { status: 400 }
      );
    }

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
        model: 'tts-1',
        voice: 'onyx',
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
    return NextResponse.json(
      { error: 'TTS generation failed', details: String(err) },
      { status: 500 }
    );
  }
});

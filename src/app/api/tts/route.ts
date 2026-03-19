import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { checkRateLimit, incrementUsage, getMonthlyServiceUsage, trackServiceUsage } from '@/lib/rateLimit';
import { TtsSchema } from '@/lib/validation';
import { safeError } from '@/lib/errors';

const ELEVENLABS_MONTHLY_CHAR_LIMIT = 30_000;
const ELEVENLABS_CHAR_THRESHOLD = 29_000; // Switch to OpenAI when approaching limit

// ElevenLabs TTS with OpenAI fallback (auto-failover on credit exhaustion)
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

    const useStream = req.nextUrl.searchParams.get('stream') === 'true';

    // Rate limit check (shares daily quota with other Claude/AI calls)
    const { allowed, remaining } = await checkRateLimit();
    if (!allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', remaining },
        { status: 429 }
      );
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const voiceParam = req.nextUrl.searchParams.get('voice'); // "1" or "2"
    const voiceId = voiceParam === '2'
      ? process.env.ELEVENLABS_VOICE_ID_2
      : process.env.ELEVENLABS_VOICE_ID;

    // Check ElevenLabs monthly credit before attempting
    let elevenLabsExhausted = false;
    if (elevenLabsKey && voiceId) {
      try {
        const monthlyChars = await getMonthlyServiceUsage('elevenlabs', 'characters_used');
        if (monthlyChars + text.length >= ELEVENLABS_CHAR_THRESHOLD) {
          elevenLabsExhausted = true;
          console.log(`ElevenLabs monthly chars ${monthlyChars}/${ELEVENLABS_MONTHLY_CHAR_LIMIT} — switching to OpenAI`);
        }
      } catch {
        // If we can't check, proceed with ElevenLabs
      }
    }

    if (elevenLabsKey && voiceId && !elevenLabsExhausted) {
      // ElevenLabs primary path
      const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
      const endpoint = useStream
        ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`
        : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

      const ttsRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.4,
          },
        }),
      });

      if (!ttsRes.ok) {
        const err = await ttsRes.text();
        console.error(`ElevenLabs TTS error: ${ttsRes.status} ${err}`);
        // Fall through to OpenAI fallback
      } else {
        await incrementUsage();
        await trackServiceUsage('elevenlabs', { characters: text.length });

        if (useStream && ttsRes.body) {
          // Streaming response — pass through chunks
          return new NextResponse(ttsRes.body, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'Transfer-Encoding': 'chunked',
            },
          });
        }

        const audioBuffer = await ttsRes.arrayBuffer();
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(audioBuffer.byteLength),
          },
        });
      }
    }

    // OpenAI fallback
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'No TTS API key configured (ElevenLabs or OpenAI)' },
        { status: 500 }
      );
    }

    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
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
    await trackServiceUsage('openai', { characters: text.length });

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

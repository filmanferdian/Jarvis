import { supabase } from '@/lib/supabase';
import { getMonthlyServiceUsage, trackServiceUsage, incrementUsage } from '@/lib/rateLimit';

const ELEVENLABS_MONTHLY_CHAR_LIMIT = 30_000;
const ELEVENLABS_CHAR_THRESHOLD = 29_000;
const STORAGE_BUCKET = 'briefing-audio';

/**
 * Generate TTS audio buffer from text using ElevenLabs (primary) or OpenAI (fallback).
 * Returns the audio as an ArrayBuffer (mp3 format).
 */
export async function generateTtsAudio(text: string): Promise<Buffer> {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  // Check ElevenLabs monthly credit
  let elevenLabsExhausted = false;
  if (elevenLabsKey && voiceId) {
    try {
      const monthlyChars = await getMonthlyServiceUsage('elevenlabs', 'characters_used');
      if (monthlyChars + text.length >= ELEVENLABS_CHAR_THRESHOLD) {
        elevenLabsExhausted = true;
        console.log(`[TTS] ElevenLabs monthly chars ${monthlyChars}/${ELEVENLABS_MONTHLY_CHAR_LIMIT} — switching to OpenAI`);
      }
    } catch { /* proceed with ElevenLabs */ }
  }

  // Try ElevenLabs first
  if (elevenLabsKey && voiceId && !elevenLabsExhausted) {
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

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
          stability: 0.75,
          similarity_boost: 0.8,
          style: 0,
        },
      }),
    });

    if (ttsRes.ok) {
      await incrementUsage();
      await trackServiceUsage('elevenlabs', { characters: text.length });
      const arrayBuffer = await ttsRes.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    console.error(`[TTS] ElevenLabs error: ${ttsRes.status} — falling back to OpenAI`);
  }

  // OpenAI fallback
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('No TTS API key configured (ElevenLabs or OpenAI)');
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
  const arrayBuffer = await ttsRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Ensure the briefing-audio storage bucket exists.
 */
async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.getBucket(STORAGE_BUCKET);
  if (error) {
    // Bucket doesn't exist — create it (private, only accessible via signed URLs)
    const { error: createErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
    });
    if (createErr && !createErr.message?.includes('already exists')) {
      console.error('[TTS Storage] Failed to create bucket:', createErr);
    }
  }
}

/**
 * Generate TTS audio, upload to Supabase Storage, and return a signed URL.
 * Also cleans up the previous day's audio file.
 */
export async function generateAndStoreAudio(
  text: string,
  date: string, // YYYY-MM-DD
): Promise<string | null> {
  try {
    await ensureBucket();

    // Generate the audio
    const audioBuffer = await generateTtsAudio(text);
    const filePath = `briefing-${date}.mp3`;

    // Upload to Supabase Storage (upsert: overwrite if exists)
    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadErr) {
      console.error('[TTS Storage] Upload error:', uploadErr);
      return null;
    }

    // Generate a signed URL valid for 24 hours
    const { data: signedData, error: signErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours

    if (signErr || !signedData?.signedUrl) {
      console.error('[TTS Storage] Signed URL error:', signErr);
      return null;
    }

    // Clean up previous day's audio
    await cleanupPreviousDayAudio(date);

    console.log(`[TTS Storage] Audio stored: ${filePath} (${(audioBuffer.length / 1024).toFixed(0)}KB)`);
    return signedData.signedUrl;
  } catch (err) {
    console.error('[TTS Storage] Failed to generate and store audio:', err);
    return null;
  }
}

/**
 * Delete previous day's audio file from storage to preserve space.
 */
async function cleanupPreviousDayAudio(currentDate: string): Promise<void> {
  try {
    const current = new Date(currentDate);
    current.setDate(current.getDate() - 1);
    const previousDate = current.toISOString().split('T')[0];
    const previousFile = `briefing-${previousDate}.mp3`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([previousFile]);

    if (error) {
      // Not critical — file may not exist
      console.log(`[TTS Storage] Cleanup note: ${error.message}`);
    } else {
      console.log(`[TTS Storage] Cleaned up: ${previousFile}`);
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get a fresh signed URL for today's audio (if file exists in storage).
 * Called by GET /api/briefing to ensure the URL hasn't expired.
 */
export async function getAudioSignedUrl(date: string): Promise<string | null> {
  try {
    const filePath = `briefing-${date}.mp3`;

    const { data: signedData, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 24 * 60 * 60);

    if (error || !signedData?.signedUrl) return null;
    return signedData.signedUrl;
  } catch {
    return null;
  }
}

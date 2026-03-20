import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getAudioSignedUrl } from '@/lib/tts';

// GET: Fetch today's cached briefing
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Use WIB timezone (UTC+7) for date
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('briefing_cache')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return NextResponse.json({
        date: today,
        briefing: null,
        message: 'No briefing generated yet for today',
      });
    }

    // Get a fresh signed URL for stored audio (signed URLs expire after 24h)
    let audioUrl: string | null = null;
    if (data.audio_url) {
      audioUrl = await getAudioSignedUrl(today);
    }

    return NextResponse.json({
      date: today,
      briefing: data.briefing_text,
      voiceover: data.voiceover_text || data.briefing_text,
      audioUrl,
      generatedAt: data.generated_at,
      dataSources: data.data_sources_used,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch briefing' },
      { status: 500 }
    );
  }
});

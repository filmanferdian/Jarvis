import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Fetch today's news synthesis (latest slot + all slots)
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Use WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    // Fetch recent news syntheses across dates (not just today)
    const { data, error } = await supabase
      .from('news_synthesis')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({
        date: today,
        latest: null,
        slots: [],
        message: 'No current events briefing available for today',
      });
    }

    // Latest slot with meaningful content (skip empty slots)
    const latest = data.find((d) => d.synthesis_text && d.synthesis_text.length > 100) ?? data[0];
    // Previous: first meaningful slot from a DIFFERENT date than today
    const previous = data.find((d) => d.date !== today && d.synthesis_text && d.synthesis_text.length > 100) ?? null;

    return NextResponse.json({
      date: today,
      latest: {
        timeSlot: latest.time_slot,
        synthesis: latest.synthesis_text,
        voiceover: latest.synthesis_text,
        emailCount: latest.email_count,
        sourcesUsed: latest.sources_used,
        generatedAt: latest.generated_at,
      },
      previous: previous ? {
        date: previous.date,
        timeSlot: previous.time_slot,
        synthesis: previous.synthesis_text,
        generatedAt: previous.generated_at,
      } : null,
      slots: data.filter((d) => d.date === today).map((d) => ({
        timeSlot: d.time_slot,
        synthesis: d.synthesis_text,
        emailCount: d.email_count,
        sourcesUsed: d.sources_used,
        generatedAt: d.generated_at,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch news synthesis' },
      { status: 500 },
    );
  }
});

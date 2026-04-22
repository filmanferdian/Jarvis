import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Fetch recent news synthesis — three tabs (email / indonesia / international).
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

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

    type Row = typeof data[number] & {
      indonesia_synthesis?: string | null;
      international_synthesis?: string | null;
      indonesia_sources?: string[] | null;
      international_sources?: string[] | null;
      indonesia_article_count?: number | null;
      international_article_count?: number | null;
    };

    const hasContent = (row: Row) =>
      (row.synthesis_text && row.synthesis_text.length > 100) ||
      (row.indonesia_synthesis && row.indonesia_synthesis.length > 100) ||
      (row.international_synthesis && row.international_synthesis.length > 100);

    const latest = (data as Row[]).find(hasContent) ?? (data[0] as Row);
    const previous =
      (data as Row[]).find((d) => d.date !== today && hasContent(d)) ?? null;

    const shapeTabs = (row: Row) => ({
      email: {
        synthesis: row.synthesis_text || '',
        sources: row.sources_used || [],
        count: row.email_count || 0,
      },
      indonesia: {
        synthesis: row.indonesia_synthesis || '',
        sources: row.indonesia_sources || [],
        count: row.indonesia_article_count || 0,
      },
      international: {
        synthesis: row.international_synthesis || '',
        sources: row.international_sources || [],
        count: row.international_article_count || 0,
      },
    });

    return NextResponse.json({
      date: today,
      latest: {
        timeSlot: latest.time_slot,
        generatedAt: latest.generated_at,
        // Legacy fields preserved for any older client caches.
        synthesis: latest.synthesis_text,
        voiceover: latest.synthesis_text,
        emailCount: latest.email_count,
        sourcesUsed: latest.sources_used,
        tabs: shapeTabs(latest),
      },
      previous: previous
        ? {
            date: previous.date,
            timeSlot: previous.time_slot,
            synthesis: previous.synthesis_text,
            generatedAt: previous.generated_at,
            tabs: shapeTabs(previous),
          }
        : null,
      slots: (data as Row[])
        .filter((d) => d.date === today)
        .map((d) => ({
          timeSlot: d.time_slot,
          generatedAt: d.generated_at,
          // Legacy
          synthesis: d.synthesis_text,
          emailCount: d.email_count,
          sourcesUsed: d.sources_used,
          tabs: shapeTabs(d),
        })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch news synthesis' }, { status: 500 });
  }
});

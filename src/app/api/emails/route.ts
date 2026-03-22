import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Fetch today's email synthesis
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Use WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    // Fetch 2 most recent syntheses (current + previous period)
    const { data, error } = await supabase
      .from('email_synthesis')
      .select('*')
      .order('date', { ascending: false })
      .limit(2);

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({
        date: today,
        synthesis: null,
        message: 'No email synthesis available for today',
      });
    }

    const latest = data[0];
    const previous = data.length > 1 ? data[1] : null;

    return NextResponse.json({
      date: today,
      synthesis: latest.synthesis_text,
      voiceover: latest.voiceover_text || latest.synthesis_text,
      importantCount: latest.important_count,
      deadlineCount: latest.deadline_count,
      createdAt: latest.created_at,
      previous: previous ? {
        date: previous.date,
        synthesis: previous.synthesis_text,
        importantCount: previous.important_count,
        createdAt: previous.created_at,
      } : null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch email synthesis' },
      { status: 500 }
    );
  }
});

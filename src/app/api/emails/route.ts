import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

// GET: Fetch today's email synthesis (all slots)
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // Use WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];

    // Fetch recent syntheses across dates (latest slots first)
    const { data, error } = await supabase
      .from('email_synthesis')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({
        date: today,
        synthesis: null,
        slots: [],
        message: 'No email synthesis available for today',
      });
    }

    // Latest slot with meaningful content
    const latest = data.find((d) => d.synthesis_text && d.synthesis_text.length > 100) ?? data[0];

    // All today's non-empty slots (for multi-slot display)
    const todaySlots = data
      .filter((d) => d.date === today && d.synthesis_text && d.synthesis_text.length > 100)
      .map((d) => ({
        timeSlot: d.time_slot || 'evening',
        label: SLOT_LABELS[d.time_slot || 'evening'] || d.time_slot,
        synthesis: d.synthesis_text,
        importantCount: d.important_count,
        deadlineCount: d.deadline_count,
        createdAt: d.created_at,
      }));

    // Previous: most recent non-empty slot NOT in todaySlots
    const todayIds = new Set(todaySlots.map((s) => s.createdAt));
    const previous = data.find(
      (d) => !todayIds.has(d.created_at) && d.synthesis_text && d.synthesis_text.length > 100
    );

    return NextResponse.json({
      date: today,
      synthesis: latest.synthesis_text,
      voiceover: latest.voiceover_text || latest.synthesis_text,
      importantCount: latest.important_count,
      deadlineCount: latest.deadline_count,
      createdAt: latest.created_at,
      timeSlot: latest.time_slot || 'evening',
      slots: todaySlots,
      previous: previous ? {
        date: previous.date,
        timeSlot: previous.time_slot || 'evening',
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

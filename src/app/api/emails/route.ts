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

    const { data, error } = await supabase
      .from('email_synthesis')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return NextResponse.json({
        date: today,
        synthesis: null,
        message: 'No email synthesis available for today',
      });
    }

    return NextResponse.json({
      date: today,
      synthesis: data.synthesis_text,
      importantCount: data.important_count,
      deadlineCount: data.deadline_count,
      createdAt: data.created_at,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch email synthesis' },
      { status: 500 }
    );
  }
});

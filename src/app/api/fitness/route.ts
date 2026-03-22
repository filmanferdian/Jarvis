import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// GET: Today's fitness context for dashboard + briefing
export const GET = withAuth(async (_req: NextRequest) => {
  try {
    // WIB today
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const dayOfWeek = wibDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Jakarta' }).toLowerCase();

    // Fetch fitness context (single row)
    const { data: ctx } = await supabase
      .from('fitness_context')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    if (!ctx) {
      return NextResponse.json({
        available: false,
        message: 'No fitness context synced yet. Run POST /api/sync/fitness first.',
      });
    }

    // Determine today's training and cardio
    const trainingDayMap = ctx.training_day_map as Record<string, Record<string, unknown>>;
    const cardioSchedule = ctx.cardio_schedule as Record<string, string>;
    const todayTraining = trainingDayMap[dayOfWeek] || null;
    const todayCardio = cardioSchedule[dayOfWeek] || null;

    // Determine if training day or rest day
    const isTrainingDay = todayTraining && todayTraining.type !== 'Rest';
    const macros = isTrainingDay ? ctx.macro_training : ctx.macro_rest;

    // Calculate weeks until deload
    const weeksToDeload = ctx.next_deload_week ? ctx.next_deload_week - ctx.current_week : null;
    const isDeloadWeek = ctx.current_week === ctx.next_deload_week;

    const today = wibDate.toISOString().split('T')[0];

    return NextResponse.json({
      available: true,
      date: today,
      day: dayOfWeek,
      current_week: ctx.current_week,
      current_phase: ctx.current_phase,
      phase_end_week: ctx.phase_end_week,
      phase_tone: ctx.phase_tone,
      is_training_day: isTrainingDay,
      is_deload_week: isDeloadWeek,
      training: todayTraining,
      cardio: todayCardio,
      macros,
      eating_window: ctx.eating_window,
      milestones: ctx.milestones,
      next_deload_week: ctx.next_deload_week,
      weeks_to_deload: weeksToDeload,
      daily_habits: ctx.daily_habits,
      steps_target: ctx.steps_target || 10000,
      special_notes: ctx.special_notes,
      synced_at: ctx.synced_at,
    });
  } catch (err) {
    console.error('[API Error] Fitness context fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch fitness context' },
      { status: 500 }
    );
  }
});

import { supabase } from '@/lib/supabase';

export interface RedFlag {
  level: 'red' | 'yellow' | 'green';
  category: string;
  message: string;
}

interface FitnessCtx {
  current_week: number;
  next_deload_week: number | null;
  milestones: Array<{ week: number; weight: string; marker: string }> | null;
  phase_end_week: number | null;
  current_phase: string;
}

function getWibToday(): string {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  return wibDate.toISOString().split('T')[0];
}

export async function detectRedFlags(fitnessCtx: FitnessCtx): Promise<RedFlag[]> {
  const flags: RedFlag[] = [];
  const today = getWibToday();

  // 1. Weight stall detection (>2 weeks at same weight)
  const twoWeeksAgo = new Date(new Date(today).getTime() - 14 * 86400000).toISOString().split('T')[0];
  const { data: recentWeights } = await supabase
    .from('weight_log')
    .select('date, weight_kg')
    .gte('date', twoWeeksAgo)
    .order('date', { ascending: true });

  if (recentWeights && recentWeights.length >= 2) {
    const firstWeight = recentWeights[0].weight_kg;
    const lastWeight = recentWeights[recentWeights.length - 1].weight_kg;
    const delta = firstWeight - lastWeight;

    if (Math.abs(delta) < 0.3) {
      flags.push({
        level: 'yellow',
        category: 'weight_stall',
        message: `Weight has been flat for 2 weeks (${lastWeight}kg). The program suggests reducing carbs by 30g or adding 10min cardio.`,
      });
    } else if (delta > 1.0) {
      // Losing >1kg/week — check last 7 days specifically
      const oneWeekAgo = new Date(new Date(today).getTime() - 7 * 86400000).toISOString().split('T')[0];
      const weekWeights = recentWeights.filter((w) => w.date >= oneWeekAgo);
      if (weekWeights.length >= 2) {
        const weekDelta = weekWeights[0].weight_kg - weekWeights[weekWeights.length - 1].weight_kg;
        if (weekDelta > 1.0) {
          flags.push({
            level: 'yellow',
            category: 'rapid_loss',
            message: `You've lost ${weekDelta.toFixed(1)}kg this week — faster than the 0.5kg target. Consider adding 100-200 calories to protect muscle.`,
          });
        }
      }
    }
  }

  // 2. Workout completion (missed >2 in a month)
  const thirtyDaysAgo = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().split('T')[0];
  const { data: activities } = await supabase
    .from('garmin_activities')
    .select('activity_type, started_at')
    .gte('started_at', `${thirtyDaysAgo}T00:00:00`)
    .order('started_at', { ascending: false });

  if (activities) {
    // Count strength training sessions in last 30 days
    const strengthSessions = activities.filter((a) =>
      a.activity_type?.toLowerCase().includes('strength') ||
      a.activity_type?.toLowerCase().includes('training') ||
      a.activity_type?.toLowerCase().includes('gym')
    ).length;

    // Expected: ~4 sessions/week × 4 weeks = ~16
    const expectedSessions = 16;
    const missed = expectedSessions - strengthSessions;

    if (missed > 4) {
      flags.push({
        level: 'red',
        category: 'missed_workouts',
        message: `Only ${strengthSessions} strength sessions in the last 30 days (expected ~16). Training consistency is critical for muscle preservation in a deficit.`,
      });
    } else if (missed > 2) {
      flags.push({
        level: 'yellow',
        category: 'missed_workouts',
        message: `${strengthSessions} of ~16 expected strength sessions in the last 30 days. Try to maintain 4 sessions per week.`,
      });
    }
  }

  // 3. Deload approaching
  if (fitnessCtx.next_deload_week) {
    const weeksToDeload = fitnessCtx.next_deload_week - fitnessCtx.current_week;
    if (weeksToDeload === 0) {
      flags.push({
        level: 'green',
        category: 'deload',
        message: 'Deload week. Same weights, half the sets. The purpose is recovery, not progress.',
      });
    } else if (weeksToDeload === 1) {
      flags.push({
        level: 'green',
        category: 'deload_approaching',
        message: 'Deload week starts next week. Push hard this week — recovery is coming.',
      });
    }
  }

  // 4. Phase transition approaching
  if (fitnessCtx.phase_end_week) {
    const weeksToPhaseEnd = fitnessCtx.phase_end_week - fitnessCtx.current_week;
    if (weeksToPhaseEnd <= 2 && weeksToPhaseEnd > 0) {
      flags.push({
        level: 'green',
        category: 'phase_transition',
        message: `${fitnessCtx.current_phase} ends in ${weeksToPhaseEnd} week${weeksToPhaseEnd > 1 ? 's' : ''}. Review your progress and prepare for the next phase.`,
      });
    }
  }

  // 5. Sleep quality (from garmin_daily — last 3 days)
  const threeDaysAgo = new Date(new Date(today).getTime() - 3 * 86400000).toISOString().split('T')[0];
  const { data: recentSleep } = await supabase
    .from('garmin_daily')
    .select('date, sleep_duration_seconds, sleep_score')
    .gte('date', threeDaysAgo)
    .order('date', { ascending: false });

  if (recentSleep && recentSleep.length >= 2) {
    const avgSleepHours = recentSleep
      .filter((s) => s.sleep_duration_seconds != null)
      .reduce((sum, s) => sum + (s.sleep_duration_seconds! / 3600), 0) / recentSleep.length;

    if (avgSleepHours < 6) {
      flags.push({
        level: 'yellow',
        category: 'sleep',
        message: `Sleep has averaged ${avgSleepHours.toFixed(1)} hours over the last ${recentSleep.length} days. The program recommends 7+ hours for recovery. Consider adjusting bedtime.`,
      });
    }
  }

  // 6. Milestone proximity
  if (fitnessCtx.milestones && recentWeights && recentWeights.length > 0) {
    const currentWeight = recentWeights[recentWeights.length - 1].weight_kg;
    const nextMilestone = fitnessCtx.milestones.find((m) => {
      const targetKg = parseFloat(m.weight.replace('kg', ''));
      return targetKg < currentWeight;
    });

    if (nextMilestone) {
      const targetKg = parseFloat(nextMilestone.weight.replace('kg', ''));
      const remaining = currentWeight - targetKg;
      if (remaining <= 1.0 && remaining > 0) {
        flags.push({
          level: 'green',
          category: 'milestone_close',
          message: `You're ${remaining.toFixed(1)}kg away from the Week ${nextMilestone.week} milestone (${nextMilestone.weight}). ${nextMilestone.marker}.`,
        });
      }
    }
  }

  return flags;
}

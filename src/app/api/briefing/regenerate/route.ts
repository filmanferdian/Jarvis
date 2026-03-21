import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';
import { detectRedFlags, RedFlag } from '@/lib/fitness/redflags';
import { buildJarvisContext, allPages } from '@/lib/context';
import { generateAndStoreAudio } from '@/lib/tts';

// POST: Regenerate today's morning briefing using real calendar + tasks + fitness data
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', usage },
        { status: 429 }
      );
    }

    // Use WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const today = wibDate.toISOString().split('T')[0];
    const dayName = wibDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Jakarta' }).toLowerCase();
    const isSunday = dayName === 'sunday';

    // End of this week (Sunday)
    const dayOfWeek = wibDate.getDay();
    const endOfWeek = new Date(wibDate);
    endOfWeek.setDate(wibDate.getDate() + (7 - dayOfWeek));
    const weekEnd = endOfWeek.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [eventsRes, tasksRes, emailRes, fitnessRes, garminRes, weightRes] = await Promise.all([
      // Calendar events for today
      supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: true }),

      // Tasks due this week
      supabase
        .from('notion_tasks')
        .select('*')
        .lte('due_date', weekEnd)
        .not('status', 'in', '("Done","Archived")')
        .order('due_date', { ascending: true }),

      // Email synthesis
      supabase
        .from('email_synthesis')
        .select('synthesis_text')
        .eq('date', today)
        .single(),

      // Fitness context
      supabase
        .from('fitness_context')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single(),

      // Today's Garmin data
      supabase
        .from('garmin_daily')
        .select('sleep_score, sleep_duration_seconds, resting_hr, body_battery, steps, training_readiness')
        .eq('date', today)
        .single(),

      // Recent weight for Sunday briefing
      supabase
        .from('weight_log')
        .select('date, weight_kg')
        .order('date', { ascending: false })
        .limit(7),
    ]);

    const events = eventsRes.data;
    const tasks = tasksRes.data;
    const emailData = emailRes.data;
    let fitnessCtx = fitnessRes.data;
    const garminDaily = garminRes.data;
    const recentWeights = weightRes.data;

    // Defensive: if fitness context is stale (>7 days), force re-sync
    if (fitnessCtx?.synced_at) {
      const syncedAt = new Date(fitnessCtx.synced_at).getTime();
      const daysSinceSync = (now.getTime() - syncedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceSync > 7) {
        console.log(`[briefing] Fitness context is ${Math.round(daysSinceSync)} days stale, triggering re-sync`);
        try {
          const { syncFitness } = await import('@/lib/sync/fitness');
          const result = await syncFitness(true);
          if (result.synced) {
            // Re-fetch updated context
            const { data: refreshed } = await supabase
              .from('fitness_context')
              .select('*')
              .order('synced_at', { ascending: false })
              .limit(1)
              .single();
            if (refreshed) fitnessCtx = refreshed;
          }
        } catch (syncErr) {
          console.error('[briefing] Failed to re-sync fitness:', syncErr);
        }
      }
    }

    // Build prompt sections
    const calendarSection =
      events && events.length > 0
        ? events
            .map((e) => {
              const start = new Date(e.start_time).toLocaleTimeString(
                'en-US',
                { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }
              );
              const end = e.end_time
                ? new Date(e.end_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Jakarta',
                  })
                : '';
              return `- ${start}${end ? `–${end}` : ''}: ${e.title}`;
            })
            .join('\n')
        : 'No calendar events today.';

    const tasksSection =
      tasks && tasks.length > 0
        ? tasks
            .map(
              (t) =>
                `- [${t.status}] ${t.name}${t.priority ? ` (${t.priority})` : ''}${t.due_date ? ` — due ${t.due_date}` : ''}`
            )
            .join('\n')
        : 'No tasks due this week.';

    const emailSection = emailData?.synthesis_text
      ? `Email summary: ${emailData.synthesis_text}`
      : 'No email synthesis available.';

    // Build fitness section
    let fitnessSection = 'No fitness context available.';
    let phaseTone = '';
    let redFlagsSection = '';

    if (fitnessCtx) {
      const trainingMap = fitnessCtx.training_day_map as Record<string, Record<string, unknown>>;
      const cardioMap = fitnessCtx.cardio_schedule as Record<string, string>;
      const todayTraining = trainingMap[dayName];
      const todayCardio = cardioMap[dayName];
      const isTrainingDay = todayTraining && todayTraining.type !== 'Rest';
      const macros = isTrainingDay ? fitnessCtx.macro_training : fitnessCtx.macro_rest;
      const macroObj = macros as { calories: number; protein: number; carbs: number; fat: number };
      const eatingWindow = fitnessCtx.eating_window as { open: string; close: string; pre_workout?: string } | null;
      const habits = fitnessCtx.daily_habits as { wake_time: string; cardio_time: string; training_time: string } | null;
      const isDeloadWeek = fitnessCtx.current_week === fitnessCtx.next_deload_week;
      const weeksToDeload = fitnessCtx.next_deload_week ? fitnessCtx.next_deload_week - fitnessCtx.current_week : null;

      const exerciseList = isTrainingDay && todayTraining.exercises
        ? (todayTraining.exercises as Array<{ name: string; sets: number; reps: string }>)
            .map((e) => `  ${e.name}: ${e.sets}×${e.reps}`)
            .join('\n')
        : '';

      fitnessSection = [
        `Week ${fitnessCtx.current_week} — ${fitnessCtx.current_phase}`,
        isDeloadWeek ? 'THIS IS DELOAD WEEK — same weights, half the sets.' : '',
        `Today (${dayName}): ${isTrainingDay ? todayTraining.type : 'Rest day'}`,
        todayCardio ? `Cardio: ${todayCardio}` : '',
        exerciseList ? `Exercises:\n${exerciseList}` : '',
        `Macros (${isTrainingDay ? 'training' : 'rest'} day): ${macroObj.calories} cal | ${macroObj.protein}P / ${macroObj.carbs}C / ${macroObj.fat}F`,
        eatingWindow ? `Eating window: ${eatingWindow.open} – ${eatingWindow.close}` : '',
        isTrainingDay && eatingWindow?.pre_workout ? `Pre-workout fuel: ${eatingWindow.pre_workout} (optional)` : '',
        habits ? `Wake: ${habits.wake_time} | Cardio: ${habits.cardio_time}${isTrainingDay ? ` | Training: ${habits.training_time}` : ''}` : '',
        weeksToDeload != null && weeksToDeload > 0 ? `Next deload: Week ${fitnessCtx.next_deload_week} (${weeksToDeload} weeks away)` : '',
        fitnessCtx.special_notes || '',
      ].filter(Boolean).join('\n');

      // Phase tone for briefing style
      const toneMap: Record<string, string> = {
        encouraging_foundational: 'Be encouraging and foundational in fitness context. Emphasize building the engine, establishing habits.',
        momentum_consistency: 'Be momentum-focused. Emphasize consistency and the power of showing up.',
        empathetic_grind: 'Be empathetic about the fitness grind. Acknowledge difficulty while reinforcing progress.',
        celebratory_finish: 'Be celebratory. The finish line is in sight. Channel energy and pride.',
      };
      phaseTone = toneMap[fitnessCtx.phase_tone as string] || '';

      // Detect red flags
      const flags = await detectRedFlags({
        current_week: fitnessCtx.current_week,
        next_deload_week: fitnessCtx.next_deload_week,
        milestones: fitnessCtx.milestones as Array<{ week: number; weight: string; marker: string }> | null,
        phase_end_week: fitnessCtx.phase_end_week,
        current_phase: fitnessCtx.current_phase,
      });

      if (flags.length > 0) {
        redFlagsSection = flags
          .map((f: RedFlag) => `[${f.level.toUpperCase()}] ${f.message}`)
          .join('\n');
      }
    }

    // Build sleep/recovery context from Garmin
    let recoverySection = '';
    if (garminDaily) {
      const parts: string[] = [];
      if (garminDaily.sleep_score != null) parts.push(`Sleep score: ${garminDaily.sleep_score}/100`);
      if (garminDaily.sleep_duration_seconds != null) {
        const hrs = (garminDaily.sleep_duration_seconds / 3600).toFixed(1);
        parts.push(`Sleep duration: ${hrs}h`);
      }
      if (garminDaily.body_battery != null) parts.push(`Body battery: ${garminDaily.body_battery}/100`);
      if (garminDaily.training_readiness != null) parts.push(`Training readiness: ${garminDaily.training_readiness}/100`);
      if (garminDaily.resting_hr != null) parts.push(`Resting HR: ${garminDaily.resting_hr} bpm`);
      if (parts.length > 0) recoverySection = parts.join(' | ');
    }

    // Sunday weight check-in context
    let sundayContext = '';
    if (isSunday && recentWeights && recentWeights.length > 0) {
      const latestWeight = recentWeights[0];
      sundayContext = `SUNDAY WEIGH-IN REMINDER: Latest weight is ${latestWeight.weight_kg}kg (${latestWeight.date}).`;
      if (recentWeights.length >= 2) {
        const weekAgoWeight = recentWeights[recentWeights.length - 1];
        const delta = (weekAgoWeight.weight_kg - latestWeight.weight_kg).toFixed(1);
        sundayContext += ` Delta from ${weekAgoWeight.date}: ${delta}kg.`;
      }
      sundayContext += ' Remind sir to weigh in, take waist measurement, and log it.';
      if (fitnessCtx?.current_week && fitnessCtx.current_week % 4 === 0) {
        sundayContext += ' This is a 4-week checkpoint — progress photos are due (front, side, back).';
      }
    }

    const dateSummary = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    // --- Transformation intelligence: additional context sections ---

    // D1: Change detection — flag if program was updated recently
    let changeDetection = '';
    if (fitnessCtx?.notion_last_edited) {
      const editedAt = new Date(fitnessCtx.notion_last_edited).getTime();
      const hoursAgo = Math.round((now.getTime() - editedAt) / (1000 * 60 * 60));
      if (hoursAgo <= 48) {
        changeDetection = `PROGRAM UPDATE: The transformation program was updated ${hoursAgo} hours ago. Mention this to sir — he may want to review changes.`;
      }
    }

    // D2: Phase-aware — warn if phase transition is near
    let phaseTransition = '';
    if (fitnessCtx?.phase_end_week && fitnessCtx?.current_week) {
      const weeksRemaining = fitnessCtx.phase_end_week - fitnessCtx.current_week;
      if (weeksRemaining <= 2 && weeksRemaining > 0) {
        phaseTransition = `PHASE TRANSITION: ${fitnessCtx.current_phase} ends in ${weeksRemaining} week(s). Mention this transition.`;
      }
    }

    // D3: Planned vs actual adherence — compare training map with Garmin activities this week
    let adherenceSection = '';
    if (fitnessCtx?.training_day_map) {
      const mondayOffset = (wibDate.getDay() + 6) % 7; // 0=Mon
      const weekStartDate = new Date(wibDate);
      weekStartDate.setDate(wibDate.getDate() - mondayOffset);
      const weekStartStr = weekStartDate.toISOString().split('T')[0];

      const { data: weekActivities } = await supabase
        .from('garmin_activities')
        .select('activity_type, started_at')
        .gte('started_at', `${weekStartStr}T00:00:00`)
        .lte('started_at', `${today}T23:59:59`);

      const trainingMap = fitnessCtx.training_day_map as Record<string, Record<string, unknown>>;
      const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const daysThroughToday = daysOfWeek.slice(0, mondayOffset + 1);
      const plannedCount = daysThroughToday.filter(
        (d) => trainingMap[d] && trainingMap[d].type !== 'Rest'
      ).length;
      const actualCount = weekActivities?.filter(
        (a) => a.activity_type?.toLowerCase().match(/strength|training|weight/)
      ).length || 0;

      if (plannedCount > 0) {
        adherenceSection = `TRAINING ADHERENCE: ${actualCount}/${plannedCount} planned training sessions completed this week so far.`;
      }
    }

    // D4: Milestone tracker — target vs actual weight
    let milestoneSection = '';
    if (fitnessCtx?.milestones && recentWeights && recentWeights.length > 0) {
      const milestones = fitnessCtx.milestones as Array<{ week: number; weight: string; marker: string }>;
      const latestWeight = recentWeights[0].weight_kg;
      const currentWeek = fitnessCtx.current_week || 0;
      const nextMilestone = milestones.find((m) => m.week >= currentWeek);
      if (nextMilestone) {
        const targetKg = parseFloat(nextMilestone.weight);
        if (!isNaN(targetKg)) {
          const remaining = (latestWeight - targetKg).toFixed(1);
          milestoneSection = `MILESTONE: Current weight ${latestWeight}kg. Week ${nextMilestone.week} target: ${nextMilestone.weight}. ${remaining}kg to go. ${nextMilestone.marker}.`;
        }
      }
    }

    // D5: Recovery-aware suggestions
    let recoveryAlert = '';
    if (garminDaily) {
      const poorSleep = garminDaily.sleep_score != null && garminDaily.sleep_score < 60;
      const lowBattery = garminDaily.body_battery != null && garminDaily.body_battery < 30;
      const lowReadiness = garminDaily.training_readiness != null && garminDaily.training_readiness < 40;
      if (poorSleep || lowBattery || lowReadiness) {
        const reasons: string[] = [];
        if (poorSleep) reasons.push(`sleep score is only ${garminDaily.sleep_score}/100`);
        if (lowBattery) reasons.push(`body battery is ${garminDaily.body_battery}/100`);
        if (lowReadiness) reasons.push(`training readiness is ${garminDaily.training_readiness}/100`);
        recoveryAlert = `RECOVERY ALERT: ${reasons.join(', ')}. Suggest a lighter session or adjusted intensity — do NOT skip, just scale back.`;
      }
    }

    // D6: Biweekly check-in prompt
    let biweeklyCheckin = '';
    if (fitnessCtx?.current_week && fitnessCtx.current_week % 2 === 0 && isSunday) {
      biweeklyCheckin = 'BIWEEKLY CHECK-IN: This is a check-in week. Remind sir to review progress, compare photos, and update the program page in Notion if adjustments are needed.';
    }

    // Build the combined intelligence section
    const intelligenceNotes = [changeDetection, phaseTransition, adherenceSection, milestoneSection, recoveryAlert, biweeklyCheckin]
      .filter(Boolean)
      .join('\n');

    // --- Dual-script prompt: generates both WRITTEN and VOICEOVER ---
    const ctx = await buildJarvisContext({ pages: allPages() });

    const prompt = `${ctx.systemPrompt}

Persona guidelines for this briefing:
- Always open the voiceover with "Good morning, Mr. Ferdian" (or appropriate greeting for time of day)
- Use "sir" sparingly — once or twice per briefing, for emphasis or gentle course-correction (e.g., "If I may, sir, your sleep has been below target")
- Tone: warm but composed, protective, occasionally wry. Think Alfred noticing Bruce hasn't slept enough.
- Notice patterns and gently nudge. You don't just report data — you care about what it means.
- Example phrases: "I've taken the liberty of...", "I would be remiss not to mention...", "If I may say so...", "A rather productive morning lies ahead — shall we?"

${phaseTone}

Generate TWO versions of today's briefing, separated by the exact marker ===VOICEOVER=== on its own line.

=== VERSION 1: WRITTEN BRIEFING ===
This version is for reading on a dashboard. Write in Filman's natural voice — direct, conversational, personal. Short sentences. Not corporate, not AI-sounding. Think of how a sharp friend would brief you over coffee.

Use section markers [SCHEDULE] [FITNESS] [ACTIONS].
Target 400-500 words. No markdown formatting, no bullet points. Plain text with natural paragraph breaks.

- [SCHEDULE]: Today's date, calendar, priorities, overdue flags, email highlights.
- [FITNESS]: Training/rest status, workout details, cardio, macros, recovery metrics. ${isSunday ? 'Sunday weigh-in reminder + weekly summary.' : ''} Include coaching notes and alerts.
- [ACTIONS]: 3-5 focused items for the day.

===VOICEOVER===

=== VERSION 2: VOICEOVER SCRIPT ===
This version is read aloud by TTS. Natural spoken English — flowing sentences, conversational transitions. British butler warmth with occasional dry wit. No section markers, no lists, no formatting. Just speech.

Target 350-450 words (~3 minutes spoken). Cover the same content as the written version but optimized for listening.

Opening: "Good morning, Mr. Ferdian. It is ${dateSummary}..." then flow naturally into the day's content.

--- TODAY'S DATA ---

CALENDAR:
${calendarSection}

TASKS:
${tasksSection}

EMAIL:
${emailSection}

FITNESS PROGRAM:
${fitnessSection}

RECOVERY METRICS:
${recoverySection || 'No Garmin data available today.'}

FITNESS ALERTS:
${redFlagsSection || 'No alerts.'}

${intelligenceNotes ? `COACHING INTELLIGENCE:\n${intelligenceNotes}` : ''}

${sundayContext ? `SUNDAY CONTEXT:\n${sundayContext}` : ''}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const rawOutput = claudeData.content?.[0]?.text || 'Unable to generate briefing';

    // Track Claude API usage
    try {
      const { trackServiceUsage } = await import('@/lib/rateLimit');
      await trackServiceUsage('claude', {
        tokens_input: claudeData.usage?.input_tokens ?? 0,
        tokens_output: claudeData.usage?.output_tokens ?? 0,
      });
    } catch { /* non-critical */ }

    // Split dual-script output
    const parts = rawOutput.split('===VOICEOVER===');
    const writtenText = parts[0].trim();
    const voiceoverText = parts.length > 1 ? parts[1].trim() : writtenText;

    const dataSources = {
      calendar: !!(events && events.length > 0),
      notion_tasks: !!(tasks && tasks.length > 0),
      email: !!emailData?.synthesis_text,
      fitness: !!fitnessCtx,
      garmin: !!garminDaily,
      weight: !!(recentWeights && recentWeights.length > 0),
    };

    // Build baseline snapshot for delta briefing comparison
    // Store item IDs so delta can identify what's new vs what was already briefed
    const baselineSnapshot = {
      calendar_count: events?.length ?? 0,
      calendar_ids: events?.map(e => e.id) ?? [],
      task_count: tasks?.length ?? 0,
      task_ids: tasks?.map(t => t.id) ?? [],
      email_count: emailData ? 1 : 0,
      email_ids: emailData ? [today] : [],
    };

    // Preserve health_insights if already cached
    const { data: existingCache } = await supabase
      .from('briefing_cache')
      .select('baseline_snapshot')
      .eq('date', today)
      .single();

    const existingSnapshot = (existingCache?.baseline_snapshot as Record<string, unknown>) || {};
    const mergedSnapshot = { ...existingSnapshot, ...baselineSnapshot };

    // Upsert to briefing_cache (written + voiceover + baseline)
    const { error: dbError } = await supabase.from('briefing_cache').upsert(
      {
        date: today,
        briefing_text: writtenText,
        voiceover_text: voiceoverText,
        generated_at: new Date().toISOString(),
        data_sources_used: dataSources,
        baseline_snapshot: mergedSnapshot,
      },
      { onConflict: 'date' }
    );

    if (dbError) throw dbError;

    await incrementUsage();

    // Fire-and-forget: TTS runs in background so response returns fast
    const ttsPromise = (async () => {
      try {
        const audioUrl = await generateAndStoreAudio(voiceoverText, today);
        if (audioUrl) {
          await supabase
            .from('briefing_cache')
            .update({ audio_url: audioUrl })
            .eq('date', today);
          console.log(`[briefing] Audio pre-generated and stored for ${today}`);
        }
      } catch (audioErr) {
        console.error('[briefing] Audio pre-generation failed (non-critical):', audioErr);
      }
    })();
    ttsPromise.catch(() => {});

    return NextResponse.json({
      date: today,
      briefing: writtenText,
      voiceover: voiceoverText,
      audioUrl: null,
      generatedAt: new Date().toISOString(),
      dataSources,
    });
  } catch (err) {
    console.error('[API Error] Failed to regenerate briefing:', err);
    return NextResponse.json(
      { error: 'Failed to regenerate briefing' },
      { status: 500 }
    );
  }
});

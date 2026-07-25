import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { safeError } from '@/lib/errors';

// Read-only view over the learnings ledger. Rows are written by the weekly
// Claude Code scheduled task, never by Jarvis, so nothing here calls Claude.

const LENS_ORDER = ['github', 'tooling', 'industry'] as const;
const LENS_LABELS: Record<string, string> = {
  github: 'Trending libraries',
  tooling: 'Tooling & workflow',
  industry: 'Industry & strategy',
};

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const topic = req.nextUrl.searchParams.get('topic') || 'ai';
    const requestedWeek = req.nextUrl.searchParams.get('week');

    // Every week that has a run row, newest first. Drives the week selector.
    const { data: weekRows, error: weekErr } = await supabase
      .from('learning_runs')
      .select('week_start')
      .eq('topic', topic)
      .order('week_start', { ascending: false });
    if (weekErr) throw weekErr;

    const weeks = [...new Set((weekRows || []).map((w) => w.week_start as string))];

    if (weeks.length === 0) {
      return NextResponse.json({
        topic,
        weeks: [],
        weekStart: null,
        latest: null,
        message: 'No learnings recorded yet. The weekly review runs Sunday morning WIB.',
      });
    }

    const weekStart = requestedWeek && weeks.includes(requestedWeek) ? requestedWeek : weeks[0];

    const [{ data: runs, error: runErr }, { data: items, error: itemErr }] = await Promise.all([
      supabase
        .from('learning_runs')
        .select('lens, summary, item_count, new_count, sources_ok, sources_failed, generated_at')
        .eq('topic', topic)
        .eq('week_start', weekStart),
      supabase
        .from('learning_entries')
        .select('id, lens, title, url, source, signal, why_it_matters, rank, weeks_running, status, first_seen_week')
        .eq('topic', topic)
        .eq('week_start', weekStart)
        .order('rank', { ascending: true }),
    ]);
    if (runErr) throw runErr;
    if (itemErr) throw itemErr;

    const runByLens = new Map((runs || []).map((r) => [r.lens as string, r]));
    const itemsByLens = new Map<string, typeof items>();
    for (const it of items || []) {
      const list = itemsByLens.get(it.lens) || [];
      list.push(it);
      itemsByLens.set(it.lens, list);
    }

    // Known lenses first in a fixed order, then any unexpected ones so a new
    // lens written by the task still shows up rather than silently vanishing.
    const presentLenses = [
      ...LENS_ORDER.filter((l) => runByLens.has(l) || itemsByLens.has(l)),
      ...[...new Set([...runByLens.keys(), ...itemsByLens.keys()])].filter(
        (l) => !LENS_ORDER.includes(l as (typeof LENS_ORDER)[number]),
      ),
    ];

    const lenses = presentLenses.map((lens) => {
      const run = runByLens.get(lens);
      return {
        key: lens,
        label: LENS_LABELS[lens] || lens,
        summary: run?.summary ?? null,
        itemCount: run?.item_count ?? (itemsByLens.get(lens)?.length ?? 0),
        newCount: run?.new_count ?? 0,
        items: (itemsByLens.get(lens) || []).map((i) => ({
          id: i.id,
          title: i.title,
          url: i.url,
          source: i.source,
          signal: i.signal,
          whyItMatters: i.why_it_matters,
          rank: i.rank,
          weeksRunning: i.weeks_running,
          status: i.status,
          firstSeenWeek: i.first_seen_week,
        })),
      };
    });

    const anyRun = (runs || [])[0];

    return NextResponse.json({
      topic,
      weeks,
      weekStart,
      latest: {
        lenses,
        totalItems: (items || []).length,
        sourcesOk: anyRun?.sources_ok ?? [],
        sourcesFailed: anyRun?.sources_failed ?? [],
        generatedAt: anyRun?.generated_at ?? null,
      },
    });
  } catch (err) {
    return safeError('Failed to load learnings', err);
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { generateBriefing } from '@/lib/sync/morningBriefing';
import { runCronJob } from '@/lib/cronLog';

export const GET = withCronAuth(async (req: NextRequest) => {
  // The automated morning briefing is DISABLED by default to preserve API usage.
  // The cron-job.org job that pings this endpoint should also be paused in its
  // dashboard; this in-code gate is the authoritative kill-switch so that a
  // stray scheduled hit can never spend Claude/ElevenLabs budget.
  //
  // To re-enable the automated daily run: set MORNING_BRIEFING_ENABLED=true in
  // Railway (and un-pause the cron-job.org job).
  //
  // On-demand: call this endpoint with ?force=1 (still requires x-cron-secret)
  // to run the scheduled-style briefing manually. The dashboard "regenerate"
  // button (POST /api/briefing/regenerate) is always available regardless of
  // this flag.
  const force = req.nextUrl.searchParams.get('force') === '1';
  const enabled = process.env.MORNING_BRIEFING_ENABLED === 'true';
  if (!enabled && !force) {
    return NextResponse.json({
      skipped: true,
      reason:
        'Automated morning briefing is disabled (on-demand only). ' +
        'Set MORNING_BRIEFING_ENABLED=true to re-enable, or call with ?force=1 to run on demand.',
    });
  }

  const r = await runCronJob('morning-briefing', () => generateBriefing());
  return r.ok
    ? NextResponse.json(r.data)
    : NextResponse.json({ error: 'Morning briefing failed' }, { status: 500 });
});

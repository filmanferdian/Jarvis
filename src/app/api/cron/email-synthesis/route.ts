import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncEmails } from '@/lib/sync/emailSynthesis';
import { triageWorkEmails } from '@/lib/sync/emailTriage';
import { markSynced } from '@/lib/syncTracker';

export const maxDuration = 120;

export const GET = withCronAuth(async (_req: NextRequest) => {
  const errors: string[] = [];
  let synthesisResult;
  let triageResult;

  // 1. Email synthesis (existing)
  try {
    synthesisResult = await syncEmails();
    await markSynced('email-synthesis', 'success');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Synthesis: ${msg}`);
    console.error('Cron: Email synthesis error:', msg);
    await markSynced('email-synthesis', 'error', 0, msg.slice(0, 500));
  }

  // 2. Email triage + auto-draft (new)
  try {
    triageResult = await triageWorkEmails();
    await markSynced('email-triage', 'success', triageResult.draftsCreated);
    if (triageResult.errors.length > 0) {
      errors.push(...triageResult.errors.map((e) => `Triage: ${e}`));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Triage: ${msg}`);
    console.error('Cron: Email triage error:', msg);
    await markSynced('email-triage', 'error', 0, msg.slice(0, 500));
  }

  if (!synthesisResult && !triageResult) {
    return NextResponse.json(
      { error: 'Both synthesis and triage failed', details: errors },
      { status: 500 },
    );
  }

  return NextResponse.json({
    synthesis: synthesisResult || null,
    triage: triageResult || null,
    errors: errors.length > 0 ? errors : undefined,
  });
});

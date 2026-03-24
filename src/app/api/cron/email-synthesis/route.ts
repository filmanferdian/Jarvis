import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncEmails } from '@/lib/sync/emailSynthesis';
import { triageWorkEmails } from '@/lib/sync/emailTriage';
import { markSynced } from '@/lib/syncTracker';
import { logCronRun } from '@/lib/cronLog';

export const maxDuration = 120;

export const GET = withCronAuth(async (_req: NextRequest) => {
  const errors: string[] = [];
  let synthesisResult;
  let triageResult;
  const start = Date.now();

  // 1. Email synthesis (existing)
  try {
    synthesisResult = await syncEmails();
    const duration = Date.now() - start;
    await markSynced('email-synthesis', 'success');
    await logCronRun('email-synthesis', 'success', `synced ${synthesisResult.emailCount ?? 0} emails`, duration);
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Synthesis: ${msg}`);
    console.error('Cron: Email synthesis error:', msg);
    await markSynced('email-synthesis', 'error', 0, msg.slice(0, 500));
    await logCronRun('email-synthesis', 'error', msg.slice(0, 500), duration);
  }

  // 2. Email triage + auto-draft (new)
  const triageStart = Date.now();
  try {
    triageResult = await triageWorkEmails();
    const duration = Date.now() - triageStart;
    await markSynced('email-triage', 'success', triageResult.draftsCreated);
    await logCronRun('email-triage', 'success', `triaged ${triageResult.newEmails} emails, ${triageResult.draftsCreated} drafts`, duration);
    if (triageResult.errors.length > 0) {
      errors.push(...triageResult.errors.map((e) => `Triage: ${e}`));
    }
  } catch (err) {
    const duration = Date.now() - triageStart;
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Triage: ${msg}`);
    console.error('Cron: Email triage error:', msg);
    await markSynced('email-triage', 'error', 0, msg.slice(0, 500));
    await logCronRun('email-triage', 'error', msg.slice(0, 500), duration);
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

import { NextRequest, NextResponse, after } from 'next/server';
import { withCronAuth } from '@/lib/cronAuth';
import { syncEmails } from '@/lib/sync/emailSynthesis';
import { triageWorkEmails } from '@/lib/sync/emailTriage';
import { runCronJob } from '@/lib/cronLog';

export const maxDuration = 120;

export const GET = withCronAuth(async (_req: NextRequest) => {
  after(async () => {
    await runCronJob('email-synthesis', () => syncEmails(), {
      itemsCount: (d) => d.emailCount ?? 0,
      message: (d) => `synced ${d.emailCount ?? 0} emails`,
    });
    await runCronJob('email-triage', () => triageWorkEmails(), {
      itemsCount: (d) => d.draftsCreated,
      message: (d) => `triaged ${d.newEmails} emails, ${d.draftsCreated} drafts`,
    });
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
});

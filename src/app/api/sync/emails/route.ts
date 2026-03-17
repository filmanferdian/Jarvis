import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';
import {
  getValidAccessToken as getMicrosoftToken,
  fetchRecentEmails as fetchOutlookEmails,
} from '@/lib/microsoft';
import type { EmailSummary } from '@/lib/microsoft';
import {
  getAllConnectedAccounts,
  getValidAccessToken as getGoogleToken,
  fetchRecentEmails as fetchGmailEmails,
} from '@/lib/google';

// POST: Fetch emails from all connected inboxes, synthesize with Claude, save to Supabase
export const POST = withAuth(async (_req: NextRequest) => {
  try {
    // Check rate limit
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', usage },
        { status: 429 },
      );
    }

    const allEmails: EmailSummary[] = [];
    const errors: string[] = [];

    // 1. Fetch from Microsoft Outlook (filman@infinid.id)
    try {
      const msToken = await getMicrosoftToken();
      const outlookEmails = await fetchOutlookEmails(msToken);
      allEmails.push(...outlookEmails);
    } catch (err) {
      errors.push(`Outlook: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Fetch from all connected Google accounts
    const googleAccounts = await getAllConnectedAccounts();
    for (const account of googleAccounts) {
      try {
        const gToken = await getGoogleToken(account.id);
        const gmailEmails = await fetchGmailEmails(gToken, account.email);
        allEmails.push(...gmailEmails);
      } catch (err) {
        errors.push(`Gmail(${account.email}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (allEmails.length === 0) {
      return NextResponse.json({
        synced: false,
        message: 'No emails fetched from any account',
        errors,
        accounts: {
          outlook: errors.some(e => e.startsWith('Outlook')) ? 'error' : 'no_emails',
          google: googleAccounts.map(a => a.email),
        },
      });
    }

    // Sort by date descending
    allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Build prompt for Claude
    const emailList = allEmails
      .map(
        (e, i) =>
          `${i + 1}. [${e.source}] From: ${e.from}\n   Subject: ${e.subject}\n   Preview: ${e.snippet}`,
      )
      .join('\n\n');

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    const prompt = `You are Jarvis, a personal executive assistant. Synthesize the following emails received in the last 24 hours for ${today}.

The emails come from multiple inboxes:
- outlook: Main work email (filman@infinid.id)
- gmail: Google workspace and personal accounts

Provide:
1. A brief summary (2-3 sentences) of the overall email activity across all inboxes
2. List any IMPORTANT items that need attention (action required, decisions needed)
3. List any DEADLINES mentioned in the emails
4. Flag anything that looks urgent

Keep it concise and actionable. Under 300 words total.

--- EMAILS (${allEmails.length} total from ${new Set(allEmails.map(e => e.source)).size} accounts) ---

${emailList}

IMPORTANT: If there are no actionable emails, say so briefly. Do not fabricate information.`;

    // Call Claude API
    const anthropicKey = process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('JARVIS_ANTHROPIC_KEY not configured');
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const synthesisText =
      claudeData.content?.[0]?.text || 'Unable to generate synthesis';

    // Count important items and deadlines
    const importantMatch = synthesisText.match(
      /important|action required|urgent|attention/gi,
    );
    const deadlineMatch = synthesisText.match(
      /deadline|due|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of)/gi,
    );

    // Use WIB date
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const dateStr = wibDate.toISOString().split('T')[0];

    // Delete existing entry for today, then insert fresh
    await supabase.from('email_synthesis').delete().eq('date', dateStr);

    const { error: dbError } = await supabase.from('email_synthesis').insert({
      date: dateStr,
      synthesis_text: synthesisText,
      important_count: importantMatch ? Math.min(importantMatch.length, 10) : 0,
      deadline_count: deadlineMatch ? Math.min(deadlineMatch.length, 10) : 0,
    });

    if (dbError) throw dbError;

    await incrementUsage();

    return NextResponse.json({
      synced: true,
      date: dateStr,
      emailCount: allEmails.length,
      sources: [...new Set(allEmails.map(e => e.source))],
      synthesis: synthesisText,
      importantCount: importantMatch ? Math.min(importantMatch.length, 10) : 0,
      deadlineCount: deadlineMatch ? Math.min(deadlineMatch.length, 10) : 0,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('[API Error] Email sync failed:', err);
    return NextResponse.json(
      { error: 'Email sync failed' },
      { status: 500 },
    );
  }
});

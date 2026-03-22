import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';
import {
  getValidAccessToken as getMicrosoftToken,
  fetchSentEmailsWithBody as fetchOutlookSent,
} from '@/lib/microsoft';
import type { SentEmailDetail } from '@/lib/microsoft';
import {
  getAllConnectedAccounts,
  getValidAccessToken as getGoogleToken,
  fetchSentEmailsWithBody as fetchGmailSent,
} from '@/lib/google';

export const maxDuration = 120;

export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', usage },
        { status: 429 },
      );
    }

    const allSent: SentEmailDetail[] = [];
    const errors: string[] = [];

    // Fetch Outlook sent emails
    const outlookPromise = (async () => {
      try {
        const msToken = await getMicrosoftToken();
        const emails = await fetchOutlookSent(msToken);
        allSent.push(...emails);
      } catch (err) {
        errors.push(`Outlook: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();

    // Fetch Gmail sent emails for all connected accounts
    const gmailPromise = (async () => {
      const accounts = await getAllConnectedAccounts();
      for (const account of accounts) {
        try {
          const gToken = await getGoogleToken(account.id);
          const emails = await fetchGmailSent(gToken, account.email);
          allSent.push(...emails);
        } catch (err) {
          errors.push(`Gmail(${account.email}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    })();

    await Promise.all([outlookPromise, gmailPromise]);

    if (allSent.length === 0) {
      return NextResponse.json(
        { error: 'No sent emails fetched from any account', errors },
        { status: 404 },
      );
    }

    // Sort by date descending
    allSent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Format emails for Claude
    const emailList = allSent
      .map(
        (e, i) =>
          `Email #${i + 1}\nTo: ${e.to}\nSubject: ${e.subject}\nDate: ${e.date}\n---\n${e.body}\n===`,
      )
      .join('\n\n');

    const prompt = `Analyze the following ${allSent.length} sent emails from Filman to distill his email communication style patterns.

Focus on:

1. **Tone & Register**: Overall tone (formal/informal/mixed). How it shifts by recipient type (internal team vs external partners vs clients).
2. **Language Switching**: When does he use Indonesian vs English? Does he mix languages within a single email? What triggers the switch?
3. **Greeting Patterns**: How does he open emails? Common greetings by context.
4. **Closing Patterns**: How does he sign off? Common closings, signature style.
5. **Sentence Structure**: Average sentence length. Simple or compound? Fragmented or complete?
6. **Paragraph Structure**: Short or long paragraphs? Use of line breaks and whitespace.
7. **Formatting Habits**: Bullet points, numbered lists, bold text, or plain prose?
8. **Vocabulary & Phrasing**: Characteristic words or phrases he repeats. Level of directness. Filler words.
9. **Email Length**: When does he write long vs short emails? What determines length?
10. **Actionability**: How does he make requests? Direct commands, polite asks, passive suggestions?

Return a structured style guide that could be used to ghostwrite emails in Filman's authentic voice. Include specific examples and direct quotes from the emails where possible.

--- SENT EMAILS (${allSent.length} total) ---

${emailList}`;

    const anthropicKey = process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('JARVIS_ANTHROPIC_KEY not configured');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const analysis = claudeData.content?.[0]?.text || 'Unable to generate style analysis';

    // Track usage
    try {
      const { trackServiceUsage } = await import('@/lib/rateLimit');
      await trackServiceUsage('claude', {
        tokens_input: claudeData.usage?.input_tokens ?? 0,
        tokens_output: claudeData.usage?.output_tokens ?? 0,
      });
    } catch { /* non-critical */ }

    await incrementUsage();

    return NextResponse.json({
      emailCount: allSent.length,
      sources: [...new Set(allSent.map(() => 'outlook').concat(['gmail']))],
      analysis,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[API Error] Failed to analyze email style:', err);
    return NextResponse.json(
      { error: 'Failed to analyze email style' },
      { status: 500 },
    );
  }
});

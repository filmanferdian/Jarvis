import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, incrementUsage } from '@/lib/rateLimit';

// POST: Trigger email synthesis on-demand using Gmail MCP data
// This endpoint accepts pre-fetched email data and generates a synthesis via Claude
export const POST = withAuth(async (req: NextRequest) => {
  try {
    // Check rate limit
    const usage = await checkRateLimit();
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Daily API limit reached', usage },
        { status: 429 }
      );
    }

    const body = await req.json();
    const emails: { from: string; subject: string; snippet: string; date: string }[] = body.emails || [];

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'No emails provided' },
        { status: 400 }
      );
    }

    // Build prompt
    const emailList = emails
      .map(
        (e, i) =>
          `${i + 1}. From: ${e.from}\n   Subject: ${e.subject}\n   Preview: ${e.snippet}`
      )
      .join('\n\n');

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta',
    });

    const prompt = `You are Jarvis — a refined British butler and chief of staff to Filman Ferdian. Synthesize the following emails received recently for ${today}.

Generate TWO versions separated by the exact marker ===VOICEOVER=== on its own line.

=== VERSION 1: WRITTEN SUMMARY ===
Direct, scannable. No fluff. Include:
1. Brief summary (2-3 sentences) of overall email activity
2. IMPORTANT items needing attention (actions, decisions)
3. DEADLINES mentioned
4. Urgent flags

Keep it under 200 words. No markdown.

===VOICEOVER===

=== VERSION 2: VOICEOVER ===
2-3 spoken sentences summarizing the email situation. British butler tone — warm, composed. Use "Mr. Ferdian" once. Occasional "sir" if flagging something important. For TTS playback.

--- EMAILS (${emails.length} total) ---

${emailList}

IMPORTANT: If there are no actionable emails, say so briefly. Do not fabricate information.`;

    // Call Claude API
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': (process.env.JARVIS_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY)!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const rawOutput = claudeData.content?.[0]?.text || 'Unable to generate synthesis';

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
    const synthesisText = parts[0].trim();
    const voiceoverText = parts.length > 1 ? parts[1].trim() : synthesisText;

    // Count important items and deadlines
    const importantMatch = synthesisText.match(
      /important|action required|urgent|attention/gi
    );
    const deadlineMatch = synthesisText.match(
      /deadline|due|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of)/gi
    );

    const dateStr = new Date().toISOString().split('T')[0];

    // Save to Supabase (written + voiceover)
    const { error: dbError } = await supabase.from('email_synthesis').upsert(
      {
        date: dateStr,
        synthesis_text: synthesisText,
        voiceover_text: voiceoverText,
        important_count: importantMatch
          ? Math.min(importantMatch.length, 10)
          : 0,
        deadline_count: deadlineMatch
          ? Math.min(deadlineMatch.length, 10)
          : 0,
      },
      { onConflict: 'date' }
    );

    if (dbError) throw dbError;

    await incrementUsage();

    return NextResponse.json({
      date: dateStr,
      synthesis: synthesisText,
      voiceover: voiceoverText,
      importantCount: importantMatch
        ? Math.min(importantMatch.length, 10)
        : 0,
      deadlineCount: deadlineMatch ? Math.min(deadlineMatch.length, 10) : 0,
    });
  } catch (err) {
    console.error('[API Error] Failed to synthesize emails:', err);
    return NextResponse.json(
      { error: 'Failed to synthesize emails' },
      { status: 500 }
    );
  }
});

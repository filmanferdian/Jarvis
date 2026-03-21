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
import { buildJarvisContext } from '@/lib/context';

// --- Newsletter source whitelist ---

interface NewsSource {
  match: (from: string) => boolean;
  label: string;
  tier: 'primary' | 'secondary' | 'contextual';
}

const NEWS_SOURCES: Record<string, NewsSource> = {
  bloomberg: { match: (f) => /bloomberg/i.test(f), label: 'Bloomberg', tier: 'primary' },
  nyt: { match: (f) => /nytimes\.com|nytdirect/i.test(f), label: 'NYT', tier: 'primary' },
  econTimes: { match: (f) => /economictimes/i.test(f), label: 'Economic Times', tier: 'secondary' },
  stockbit: { match: (f) => /stockbit/i.test(f), label: 'Stockbit', tier: 'secondary' },
  crunchbase: { match: (f) => /crunchbase/i.test(f), label: 'Crunchbase', tier: 'contextual' },
  mckinsey: { match: (f) => /mckinsey/i.test(f), label: 'McKinsey', tier: 'contextual' },
  dealstreet: { match: (f) => /dealstreet/i.test(f), label: 'DealStreetAsia', tier: 'contextual' },
  f6s: { match: (f) => /f6s\.com/i.test(f), label: 'F6S', tier: 'contextual' },
};

// NYT subjects to skip (non-news)
const NYT_SKIP_PATTERNS = /gameplay|crossword|well:|watching:|good list/i;

function isNewsEmail(email: EmailSummary): boolean {
  const from = email.from || '';
  for (const source of Object.values(NEWS_SOURCES)) {
    if (source.match(from)) {
      // For NYT, skip non-news newsletters
      if (source.label === 'NYT' && NYT_SKIP_PATTERNS.test(email.subject || '')) {
        return false;
      }
      return true;
    }
  }
  return false;
}

function getSourceLabel(email: EmailSummary): string {
  const from = email.from || '';
  for (const source of Object.values(NEWS_SOURCES)) {
    if (source.match(from)) return source.label;
  }
  return 'Other';
}

function getTimeSlot(): string {
  const wibOffset = 7 * 60 * 60 * 1000;
  const wib = new Date(Date.now() + wibOffset);
  const hour = wib.getUTCHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  return 'evening';
}

export interface NewsSyncResult {
  synced: boolean;
  date: string;
  timeSlot: string;
  emailCount: number;
  sourcesUsed: string[];
  synthesis: string;
  sinceTimestamp: string;
  errors?: string[];
}

export async function syncNews(): Promise<NewsSyncResult> {
  // Check rate limit
  const usage = await checkRateLimit();
  if (!usage.allowed) {
    throw new Error('Daily API limit reached');
  }

  // Determine since-last timestamp
  const { data: lastSync } = await supabase
    .from('news_synthesis')
    .select('generated_at')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  const defaultHours = 8;
  let sinceHours = defaultHours;
  let sinceTimestamp: string;

  if (lastSync?.generated_at) {
    const lastTime = new Date(lastSync.generated_at).getTime();
    const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
    sinceHours = Math.max(1, Math.ceil(hoursSince));
    sinceTimestamp = lastSync.generated_at;
  } else {
    sinceTimestamp = new Date(Date.now() - defaultHours * 60 * 60 * 1000).toISOString();
  }

  const allEmails: EmailSummary[] = [];
  const errors: string[] = [];

  // 1. Fetch from Microsoft Outlook
  try {
    const msToken = await getMicrosoftToken();
    const outlookEmails = await fetchOutlookEmails(msToken, sinceHours);
    allEmails.push(...outlookEmails);
  } catch (err) {
    errors.push(`Outlook: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Fetch from all connected Google accounts
  const googleAccounts = await getAllConnectedAccounts();
  for (const account of googleAccounts) {
    try {
      const gToken = await getGoogleToken(account.id);
      const gmailEmails = await fetchGmailEmails(gToken, account.email, sinceHours);
      allEmails.push(...gmailEmails);
    } catch (err) {
      errors.push(`Gmail(${account.email}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Filter to only news/newsletter emails
  const newsEmails = allEmails.filter(isNewsEmail);

  if (newsEmails.length === 0) {
    // Still save a result so we don't keep retrying
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    const dateStr = wibDate.toISOString().split('T')[0];
    const timeSlot = getTimeSlot();

    await supabase
      .from('news_synthesis')
      .delete()
      .eq('date', dateStr)
      .eq('time_slot', timeSlot);

    await supabase.from('news_synthesis').insert({
      date: dateStr,
      time_slot: timeSlot,
      synthesis_text: 'No current events newsletters received since the last briefing.',
      email_count: 0,
      sources_used: [],
      since_timestamp: sinceTimestamp,
    });

    return {
      synced: true,
      date: dateStr,
      timeSlot,
      emailCount: 0,
      sourcesUsed: [],
      synthesis: 'No current events newsletters received since the last briefing.',
      sinceTimestamp,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Sort by date descending
  newsEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Build source labels
  const sourcesUsed = [...new Set(newsEmails.map(getSourceLabel))];

  // Build prompt
  const emailList = newsEmails
    .map(
      (e, i) =>
        `${i + 1}. [${getSourceLabel(e)}] From: ${e.from}\n   Subject: ${e.subject}\n   Preview: ${e.snippet}`,
    )
    .join('\n\n');

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

  const timeSlot = getTimeSlot();
  const slotLabel =
    timeSlot === 'morning' ? 'Morning' : timeSlot === 'afternoon' ? 'Afternoon' : 'Evening';

  const ctx = await buildJarvisContext({ pages: ['about_me', 'work', 'projects'] });

  const prompt = `${ctx.systemPrompt}

You are synthesizing current events from newsletter emails for the ${slotLabel} briefing on ${today}.

These emails were received since ${sinceTimestamp}. Sources are tiered:
- PRIMARY (bias heavily toward these): Bloomberg, NYT
- SECONDARY (supplement): Economic Times, Stockbit
- CONTEXTUAL (sprinkle in): Crunchbase, DealStreetAsia, McKinsey, F6S

Provide TWO sections. Direct, scannable. No fluff.

## What's Happening Now
Cover the 5-7 most significant current events. Write each story as:

**Headline on one line**
A 2-3 sentence summary paragraph. Attribute the source naturally at the end in parentheses, e.g. (Bloomberg).

Do NOT use bullet points, dashes, or lists. No bold or italic on source names. Keep it direct and scannable.

Rules: Only promote CONTEXTUAL sources if corroborated by PRIMARY sources. Prioritize geopolitics, markets, tech, macro-economy.

## Relevant to Your Priorities
Cover 3-5 stories relevant to the user's work, projects, and interests. These CAN come from any source tier including DealStreetAsia, Crunchbase, Stockbit. Write each story as:

**Headline on one line**
A paragraph explaining why it matters, with source in parentheses at the end. (Source)

Do NOT use bullet points, dashes, or lists. No bold or italic on source names.

Keep total output under 600 words. If insufficient news content, note that and provide what you can. Do not fabricate stories.

===VOICEOVER===
Provide a 3-4 sentence spoken summary in Jarvis's refined British butler tone. Address "Mr. Ferdian" or "sir". Summarize the key developments concisely.

--- NEWSLETTERS (${newsEmails.length} emails from ${sourcesUsed.join(', ')}) ---

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
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const claudeData = await claudeRes.json();
  const fullText = claudeData.content?.[0]?.text || 'Unable to generate synthesis';

  // Split voiceover
  const parts = fullText.split('===VOICEOVER===');
  const synthesisText = parts[0].trim();
  const voiceoverText = parts[1]?.trim() || synthesisText;

  // Use WIB date
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffset);
  const dateStr = wibDate.toISOString().split('T')[0];

  // Delete existing entry for today's slot, then insert fresh
  await supabase
    .from('news_synthesis')
    .delete()
    .eq('date', dateStr)
    .eq('time_slot', timeSlot);

  const { error: dbError } = await supabase.from('news_synthesis').insert({
    date: dateStr,
    time_slot: timeSlot,
    synthesis_text: synthesisText,
    voiceover_text: voiceoverText,
    email_count: newsEmails.length,
    sources_used: sourcesUsed,
    since_timestamp: sinceTimestamp,
  });

  if (dbError) throw dbError;

  await incrementUsage();

  return {
    synced: true,
    date: dateStr,
    timeSlot,
    emailCount: newsEmails.length,
    sourcesUsed,
    synthesis: synthesisText,
    sinceTimestamp,
    errors: errors.length > 0 ? errors : undefined,
  };
}

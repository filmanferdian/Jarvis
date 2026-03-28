import { supabase } from './supabase';

// OAuth endpoints — use /common/ so both work and personal accounts are accepted
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'openid profile email offline_access Calendars.Read Mail.Read Mail.ReadWrite User.Read';

// --- Types ---

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

interface GraphEvent {
  id: string;
  subject: string;
  isAllDay: boolean;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: {
    emailAddress: { name: string; address: string };
    type: string;
    status: { response: string };
  }[];
}

// Re-export for contact scanner
export type { GraphEvent };

export interface CalendarEventRow {
  event_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  is_all_day: boolean;
  source: 'outlook';
  last_synced: string;
}

// --- Helpers ---

function getClientId(): string {
  const id = process.env.MICROSOFT_CLIENT_ID;
  if (!id) throw new Error('MICROSOFT_CLIENT_ID not configured');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!secret) throw new Error('MICROSOFT_CLIENT_SECRET not configured');
  return secret;
}

export function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not configured');
  return `${appUrl}/api/auth/microsoft/callback`;
}

// --- OAuth ---

export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    response_mode: 'query',
    prompt: 'consent',
  });
  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
    scope: SCOPES,
  });

  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });

  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from('microsoft_tokens')
    .select('*')
    .eq('id', 'default')
    .single();

  if (error || !data) {
    throw new Error('NO_TOKENS');
  }

  // If token expires in more than 5 minutes, use it
  const expiresAt = new Date(data.expires_at).getTime();
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() + bufferMs < expiresAt) {
    return data.access_token;
  }

  // Refresh the token
  const tokens = await refreshAccessToken(data.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from('microsoft_tokens').upsert({
    id: 'default',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || data.refresh_token, // keep old if not returned
    expires_at: newExpiresAt,
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  return tokens.access_token;
}

// --- Graph API ---

export async function fetchCalendarView(
  accessToken: string,
  startDateTime: string,
  endDateTime: string,
): Promise<GraphEvent[]> {
  const allEvents: GraphEvent[] = [];
  const initialUrl =
    `${GRAPH_BASE_URL}/me/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$top=50&$orderby=start/dateTime`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Prefer: 'outlook.timezone="Asia/Jakarta"',
  };

  // First request
  const firstRes = await fetch(initialUrl, { headers });
  if (!firstRes.ok) {
    const errText = await firstRes.text();
    throw new Error(`Graph API error: ${firstRes.status} ${errText}`);
  }
  let page = await firstRes.json();
  allEvents.push(...(page.value || []));

  // Follow pagination links
  while (page['@odata.nextLink']) {
    const nextRes = await fetch(page['@odata.nextLink'], { headers });
    if (!nextRes.ok) {
      const errText = await nextRes.text();
      throw new Error(`Graph API error: ${nextRes.status} ${errText}`);
    }
    page = await nextRes.json();
    allEvents.push(...(page.value || []));
  }

  return allEvents;
}

// --- Mail API ---

export interface EmailSummary {
  from: string;
  subject: string;
  snippet: string;
  date: string;
  source: string;
}

export async function fetchRecentEmails(
  accessToken: string,
  sinceHours: number = 24,
  limit: number = 30,
): Promise<EmailSummary[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const url =
    `${GRAPH_BASE_URL}/me/messages?$filter=receivedDateTime ge ${since}&$top=${limit}&$orderby=receivedDateTime desc&$select=from,subject,bodyPreview,receivedDateTime`;

  const response: Response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Graph Mail API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return (data.value || []).map((msg: { from?: { emailAddress?: { address?: string } }; subject?: string; bodyPreview?: string; receivedDateTime?: string }) => ({
    from: msg.from?.emailAddress?.address || 'unknown',
    subject: msg.subject || '(No subject)',
    snippet: (msg.bodyPreview || '').slice(0, 200),
    date: msg.receivedDateTime || '',
    source: 'outlook',
  }));
}

export interface SentEmailDetail {
  subject: string;
  to: string;
  date: string;
  body: string;
}

export async function fetchSentEmailsWithBody(
  accessToken: string,
  limit: number = 50,
): Promise<SentEmailDetail[]> {
  const url =
    `${GRAPH_BASE_URL}/me/mailFolders/SentItems/messages?$top=${limit}&$orderby=sentDateTime desc&$select=subject,toRecipients,sentDateTime,body`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Graph SentItems API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return (data.value || []).map((msg: {
    subject?: string;
    toRecipients?: { emailAddress?: { address?: string } }[];
    sentDateTime?: string;
    body?: { contentType?: string; content?: string };
  }) => {
    let body = msg.body?.content || '';
    if (msg.body?.contentType === 'html') {
      body = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return {
      subject: msg.subject || '(No subject)',
      to: msg.toRecipients?.[0]?.emailAddress?.address || 'unknown',
      date: msg.sentDateTime || '',
      body: body.slice(0, 3000),
    };
  });
}

// --- Full Email Fetch (for triage) ---

export interface FullEmail {
  messageId: string;
  conversationId: string;
  internetMessageId: string;
  from: string;
  fromName: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  source: 'outlook';
}

export async function fetchRecentEmailsFull(
  accessToken: string,
  sinceHours: number = 24,
  limit: number = 30,
): Promise<FullEmail[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const url =
    `${GRAPH_BASE_URL}/me/messages?$filter=receivedDateTime ge ${since}&$top=${limit}&$orderby=receivedDateTime desc&$select=id,from,toRecipients,ccRecipients,subject,bodyPreview,receivedDateTime,body,conversationId,internetMessageId`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Graph Mail Full API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return (data.value || []).map((msg: {
    id?: string;
    from?: { emailAddress?: { address?: string; name?: string } };
    toRecipients?: { emailAddress?: { address?: string; name?: string } }[];
    ccRecipients?: { emailAddress?: { address?: string; name?: string } }[];
    subject?: string;
    bodyPreview?: string;
    receivedDateTime?: string;
    body?: { contentType?: string; content?: string };
    conversationId?: string;
    internetMessageId?: string;
  }) => {
    let body = msg.body?.content || '';
    if (msg.body?.contentType === 'html') {
      body = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const toAddresses = (msg.toRecipients || [])
      .map((r) => r.emailAddress?.address || '')
      .filter(Boolean)
      .join(', ');
    const ccAddresses = (msg.ccRecipients || [])
      .map((r) => r.emailAddress?.address || '')
      .filter(Boolean)
      .join(', ');
    return {
      messageId: msg.id || '',
      conversationId: msg.conversationId || '',
      internetMessageId: msg.internetMessageId || '',
      from: msg.from?.emailAddress?.address || 'unknown',
      fromName: msg.from?.emailAddress?.name || '',
      to: toAddresses,
      cc: ccAddresses,
      subject: msg.subject || '(No subject)',
      date: msg.receivedDateTime || '',
      body: body.slice(0, 5000),
      snippet: (msg.bodyPreview || '').slice(0, 500),
      source: 'outlook' as const,
    };
  });
}

// --- Draft Creation ---

export async function createOutlookDraft(
  accessToken: string,
  params: { messageId: string; body: string },
): Promise<{ draftId: string }> {
  // Step 1: Create a reply draft (auto-threads the conversation)
  const replyRes = await fetch(
    `${GRAPH_BASE_URL}/me/messages/${params.messageId}/createReply`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );

  if (!replyRes.ok) {
    const errText = await replyRes.text();
    throw new Error(`Graph createReply error: ${replyRes.status} ${errText}`);
  }

  const replyData = await replyRes.json();
  const draftId = replyData.id;

  // Step 2: Update the draft body with our generated text
  const patchRes = await fetch(
    `${GRAPH_BASE_URL}/me/messages/${draftId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          contentType: 'Text',
          content: params.body,
        },
      }),
    },
  );

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Graph PATCH draft error: ${patchRes.status} ${errText}`);
  }

  return { draftId };
}

// --- Calendar Transform ---

export function transformGraphEvent(event: GraphEvent): CalendarEventRow {
  const now = new Date().toISOString();

  let startTime: string;
  let endTime: string | null;

  if (event.isAllDay) {
    // All-day events come as floating dates, anchor to WIB
    const startDate = event.start.dateTime.split('T')[0];
    startTime = `${startDate}T00:00:00+07:00`;
    const endDate = event.end.dateTime.split('T')[0];
    endTime = `${endDate}T00:00:00+07:00`;
  } else {
    // With Prefer: outlook.timezone="Asia/Jakarta", times are already in WIB
    // Graph returns format like "2026-03-17T09:00:00.0000000" without offset
    const startRaw = event.start.dateTime.replace(/\.0+$/, '');
    const endRaw = event.end.dateTime.replace(/\.0+$/, '');
    startTime = `${startRaw}+07:00`;
    endTime = `${endRaw}+07:00`;
  }

  return {
    event_id: event.id,
    title: event.subject || '(No title)',
    start_time: startTime,
    end_time: endTime,
    is_all_day: event.isAllDay,
    source: 'outlook',
    last_synced: now,
  };
}

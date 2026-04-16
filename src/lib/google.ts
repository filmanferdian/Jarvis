import { supabase } from './supabase';
import type { EmailSummary } from './microsoft';
import { encrypt, decrypt } from './crypto';

// OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1';
const CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3';
const SCOPES = 'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/calendar.readonly';

// --- Types ---

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

interface GoogleUserInfo {
  email: string;
}

// --- Helpers ---

function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error('GOOGLE_CLIENT_ID not configured');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error('GOOGLE_CLIENT_SECRET not configured');
  return secret;
}

export function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not configured');
  return `${appUrl}/api/auth/google/callback`;
}

// --- OAuth ---

export function buildAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });
  if (state) params.set('state', state);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to get Google user info');
  const info: GoogleUserInfo = await res.json();
  return info.email;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function getValidAccessToken(accountId: string): Promise<string> {
  const { data, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error || !data) {
    throw new Error(`NO_GOOGLE_TOKENS:${accountId}`);
  }

  // H2: tokens are encrypted at rest; decrypt() passes through legacy plaintext rows.
  const storedAccess = decrypt(data.access_token);
  const storedRefresh = decrypt(data.refresh_token);

  // If token expires in more than 5 minutes, use it
  const expiresAt = new Date(data.expires_at).getTime();
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() + bufferMs < expiresAt) {
    return storedAccess;
  }

  // Refresh
  const tokens = await refreshAccessToken(storedRefresh);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from('google_tokens').upsert({
    id: accountId,
    email: data.email,
    access_token: encrypt(tokens.access_token),
    refresh_token: encrypt(tokens.refresh_token || storedRefresh),
    expires_at: newExpiresAt,
    scope: tokens.scope || data.scope,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  return tokens.access_token;
}

// --- Gmail API ---

export async function getAllConnectedAccounts(): Promise<{ id: string; email: string }[]> {
  const { data, error } = await supabase
    .from('google_tokens')
    .select('id, email');

  if (error || !data) return [];
  return data;
}

export async function fetchRecentEmails(
  accessToken: string,
  email: string,
  sinceHours: number = 24,
  limit: number = 30,
): Promise<EmailSummary[]> {
  // Search for recent emails
  const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const afterTimestamp = Math.floor(sinceDate.getTime() / 1000);
  const query = `after:${afterTimestamp}`;

  const listUrl =
    `${GMAIL_BASE_URL}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail list error: ${listRes.status} ${errText}`);
  }

  const listData = await listRes.json();
  const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

  if (messageIds.length === 0) return [];

  // Fetch each message metadata (batch up to limit)
  const emails: EmailSummary[] = [];
  for (const msgId of messageIds.slice(0, limit)) {
    const msgRes = await fetch(
      `${GMAIL_BASE_URL}/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!msgRes.ok) continue;

    const msg = await msgRes.json();
    const headers: { name: string; value: string }[] = msg.payload?.headers || [];
    const fromHeader = headers.find((h: { name: string }) => h.name === 'From')?.value || 'unknown';
    const subjectHeader = headers.find((h: { name: string }) => h.name === 'Subject')?.value || '(No subject)';

    emails.push({
      from: fromHeader,
      subject: subjectHeader,
      snippet: (msg.snippet || '').slice(0, 200),
      date: new Date(Number(msg.internalDate)).toISOString(),
      source: `gmail:${email}`,
    });
  }

  return emails;
}

export interface SentEmailDetail {
  subject: string;
  to: string;
  date: string;
  body: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextBody(payload: any): string {
  // Direct body (single-part message)
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Multipart: recurse into parts looking for text/plain first, then text/html
  if (payload.parts) {
    // First pass: text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    // Second pass: recurse into nested multipart
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith('multipart/')) {
        const nested = extractTextBody(part);
        if (nested) return nested;
      }
    }
    // Fallback: text/html with tags stripped
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  return '';
}

export async function fetchSentEmailsWithBody(
  accessToken: string,
  fromEmail: string,
  limit: number = 50,
): Promise<SentEmailDetail[]> {
  const query = `in:sent from:${fromEmail}`;
  const listUrl =
    `${GMAIL_BASE_URL}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail sent list error: ${listRes.status} ${errText}`);
  }

  const listData = await listRes.json();
  const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);
  if (messageIds.length === 0) return [];

  const results: SentEmailDetail[] = [];
  for (const msgId of messageIds.slice(0, limit)) {
    const msgRes = await fetch(
      `${GMAIL_BASE_URL}/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!msgRes.ok) continue;

    const msg = await msgRes.json();
    const headers: { name: string; value: string }[] = msg.payload?.headers || [];
    const subject = headers.find((h: { name: string }) => h.name === 'Subject')?.value || '(No subject)';
    const to = headers.find((h: { name: string }) => h.name === 'To')?.value || 'unknown';
    const body = extractTextBody(msg.payload).slice(0, 3000);

    results.push({
      subject,
      to,
      date: new Date(Number(msg.internalDate)).toISOString(),
      body,
    });
  }

  return results;
}

// --- Draft Creation ---

export async function createGmailDraft(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    body: string;
    threadId: string;
    inReplyTo?: string;
  },
): Promise<{ draftId: string }> {
  // Build RFC 2822 message
  const headers = [
    `To: ${params.to}`,
    `Subject: Re: ${params.subject.replace(/^Re:\s*/i, '')}`,
    'Content-Type: text/plain; charset=utf-8',
  ];
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    headers.push(`References: ${params.inReplyTo}`);
  }

  const rawMessage = `${headers.join('\r\n')}\r\n\r\n${params.body}`;
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch(`${GMAIL_BASE_URL}/users/me/drafts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        raw: encoded,
        threadId: params.threadId,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail draft creation error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return { draftId: data.id };
}

// --- Full Email Fetch (for triage) ---

export interface FullEmail {
  messageId: string;
  threadId: string;
  from: string;
  fromName: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  source: string;
}

export async function fetchRecentEmailsFull(
  accessToken: string,
  email: string,
  sinceHours: number = 24,
  limit: number = 30,
): Promise<FullEmail[]> {
  const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const afterTimestamp = Math.floor(sinceDate.getTime() / 1000);
  const query = `after:${afterTimestamp}`;

  const listUrl =
    `${GMAIL_BASE_URL}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail list error: ${listRes.status} ${errText}`);
  }

  const listData = await listRes.json();
  const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);
  if (messageIds.length === 0) return [];

  const results: FullEmail[] = [];
  for (const msgId of messageIds.slice(0, limit)) {
    const msgRes = await fetch(
      `${GMAIL_BASE_URL}/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!msgRes.ok) continue;

    const msg = await msgRes.json();
    const headers: { name: string; value: string }[] = msg.payload?.headers || [];
    const fromHeader = headers.find((h: { name: string }) => h.name === 'From')?.value || 'unknown';
    const toHeader = headers.find((h: { name: string }) => h.name === 'To')?.value || '';
    const ccHeader = headers.find((h: { name: string }) => h.name === 'Cc')?.value || '';
    const subject = headers.find((h: { name: string }) => h.name === 'Subject')?.value || '(No subject)';

    // Parse "Name <email>" format
    const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : '';
    const fromAddress = fromMatch ? fromMatch[2] : fromHeader;

    const body = extractTextBody(msg.payload).slice(0, 5000);

    results.push({
      messageId: msgId,
      threadId: msg.threadId || '',
      from: fromAddress,
      fromName,
      to: toHeader,
      cc: ccHeader,
      subject,
      date: new Date(Number(msg.internalDate)).toISOString(),
      body,
      snippet: (msg.snippet || '').slice(0, 500),
      source: `gmail:${email}`,
    });
  }

  return results;
}

// --- Google Calendar API ---

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
  }[];
}

// Re-export for contact scanner
export type { GoogleCalendarEvent };

export interface CalendarEventRow {
  event_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  is_all_day: boolean;
  source: string;
  last_synced: string;
}

export function transformGoogleEvent(event: GoogleCalendarEvent, source: string): CalendarEventRow {
  const now = new Date().toISOString();
  const isAllDay = !event.start.dateTime;

  let startTime: string;
  let endTime: string | null;

  if (isAllDay) {
    startTime = `${event.start.date}T00:00:00+07:00`;
    endTime = event.end.date ? `${event.end.date}T00:00:00+07:00` : null;
  } else {
    startTime = event.start.dateTime!;
    endTime = event.end.dateTime || null;
  }

  return {
    event_id: event.id,
    title: event.summary || '(No title)',
    start_time: startTime,
    end_time: endTime,
    is_all_day: isAllDay,
    source,
    last_synced: now,
  };
}

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
    timeZone: 'Asia/Jakarta',
  });

  const url = `${CALENDAR_BASE_URL}/calendars/primary/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Calendar API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.items || [];
}

/** Fetch calendar events with pagination — for contact scanning over wider date ranges */
export async function fetchCalendarEventsPaginated(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  const allEvents: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      timeZone: 'Asia/Jakarta',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `${CALENDAR_BASE_URL}/calendars/primary/events?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Calendar API error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

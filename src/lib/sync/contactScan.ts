import { supabase } from '@/lib/supabase';
import {
  getAllConnectedAccounts,
  getValidAccessToken as getGoogleToken,
  fetchCalendarEventsPaginated,
} from '@/lib/google';
import {
  getValidAccessToken as getOutlookToken,
  fetchCalendarView,
} from '@/lib/microsoft';
import {
  extractContactsFromGoogleEvents,
  extractContactsFromOutlookEvents,
  mergeContacts,
  type ScannedContact,
} from '@/lib/contacts';
import { markAccountSynced } from '@/lib/syncTracker';

// filmanferdian21@gmail.com is email-only (no calendar)
const CALENDAR_SKIP_ACCOUNTS = ['filmanferdian21@gmail.com'];
const SYNC_TYPE = 'contact-scan';
const OUTLOOK_ACCOUNT_KEY = `outlook:${process.env.WORK_OUTLOOK_ADDRESS || 'filman@infinid.id'}`;

const NOTION_API_URL = 'https://api.notion.com/v1';

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface ContactScanResult {
  new_contacts: number;
  updated_existing: number;
  total_events_scanned: number;
  contacts: Array<{
    email: string;
    name: string | null;
    company: string | null;
    status: 'new' | 'existing';
    event_count: number;
    last_seen_date: string;
  }>;
  timestamp: string;
  errors?: string[];
}

function getDateRange(mode: 'backfill' | 'weekly'): { timeMin: string; timeMax: string } {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);

  if (mode === 'backfill') {
    const start = new Date(wibNow.getTime() - 28 * 86400000);
    return {
      timeMin: `${start.toISOString().split('T')[0]}T00:00:00+07:00`,
      timeMax: `${wibNow.toISOString().split('T')[0]}T23:59:59+07:00`,
    };
  }

  // weekly: 1 week before + 1 week after
  const start = new Date(wibNow.getTime() - 7 * 86400000);
  const end = new Date(wibNow.getTime() + 7 * 86400000);
  return {
    timeMin: `${start.toISOString().split('T')[0]}T00:00:00+07:00`,
    timeMax: `${end.toISOString().split('T')[0]}T23:59:59+07:00`,
  };
}

/** Fetch all contacts from Notion Contacts DB, return email → page_id map */
async function fetchNotionContactsMap(): Promise<Map<string, string>> {
  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDbId = process.env.NOTION_CONTACTS_DB_ID;
  if (!notionApiKey || !notionDbId) return new Map();

  const emailMap = new Map<string, string>();
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(`${NOTION_API_URL}/databases/${notionDbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('[contact-scan] Notion query error:', res.status);
      break;
    }

    const data: NotionQueryResponse = await res.json();
    for (const page of data.results) {
      const emailProp = page.properties['Email Address'] as { email?: string } | undefined;
      const email = emailProp?.email?.toLowerCase().trim();
      if (email) {
        emailMap.set(email, page.id);
      }
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  console.log(`[contact-scan] Found ${emailMap.size} existing contacts in Notion`);
  return emailMap;
}

/** Update Last contact date on an existing Notion contact page */
async function updateNotionLastContact(pageId: string, date: string): Promise<void> {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) return;

  await fetch(`${NOTION_API_URL}/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      properties: {
        'Last contact': { date: { start: date } },
      },
    }),
  });
}

export async function scanCalendarContacts(
  mode: 'backfill' | 'weekly',
): Promise<ContactScanResult> {
  const { timeMin, timeMax } = getDateRange(mode);
  const errors: string[] = [];
  let totalEvents = 0;
  let allContacts: ScannedContact[] = [];

  // 1. Fetch Google Calendar events from all connected accounts
  const googleAccounts = await getAllConnectedAccounts();
  const calAccounts = googleAccounts.filter((a) => !CALENDAR_SKIP_ACCOUNTS.includes(a.email));

  for (const account of calAccounts) {
    const accountKey = `google:${account.email}`;
    try {
      const accessToken = await getGoogleToken(account.id);
      const events = await fetchCalendarEventsPaginated(accessToken, timeMin, timeMax);
      totalEvents += events.length;
      const contacts = extractContactsFromGoogleEvents(events, `google:${account.email}`);
      allContacts = mergeContacts(allContacts, contacts);
      console.log(`[contact-scan] Google ${account.email}: ${events.length} events, ${contacts.length} contacts`);
      await markAccountSynced(SYNC_TYPE, accountKey, 'success', contacts.length);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const msg = `Google ${account.email}: ${rawMsg}`;
      errors.push(msg);
      console.error(`[contact-scan] ${msg}`);
      await markAccountSynced(SYNC_TYPE, accountKey, 'error', 0, rawMsg);
    }
  }

  // 2. Fetch Outlook Calendar events
  try {
    const accessToken = await getOutlookToken();
    const events = await fetchCalendarView(accessToken, timeMin, timeMax);
    totalEvents += events.length;
    const contacts = extractContactsFromOutlookEvents(events);
    allContacts = mergeContacts(allContacts, contacts);
    console.log(`[contact-scan] Outlook: ${events.length} events, ${contacts.length} contacts`);
    await markAccountSynced(SYNC_TYPE, OUTLOOK_ACCOUNT_KEY, 'success', contacts.length);
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_TOKENS') {
      console.log('[contact-scan] Outlook not connected, skipping');
    } else {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const msg = `Outlook: ${rawMsg}`;
      errors.push(msg);
      console.error(`[contact-scan] ${msg}`);
      await markAccountSynced(SYNC_TYPE, OUTLOOK_ACCOUNT_KEY, 'error', 0, rawMsg);
    }
  }

  console.log(`[contact-scan] Total: ${totalEvents} events, ${allContacts.length} unique external contacts`);

  // 3. Match against existing Notion contacts
  const notionMap = await fetchNotionContactsMap();

  let newCount = 0;
  let existingCount = 0;
  const resultContacts: ContactScanResult['contacts'] = [];

  // 4. Fetch existing scanned_contacts for merge
  const { data: existingScanned } = await supabase
    .from('scanned_contacts')
    .select('*');
  const existingMap = new Map(
    (existingScanned || []).map((c: { email: string; event_count: number; first_seen_date: string; sources: string[] }) => [c.email, c]),
  );

  for (const contact of allContacts) {
    // Skip ignored contacts — don't overwrite their status
    const prevRecord = existingMap.get(contact.email) as {
      status?: string; event_count: number; first_seen_date: string; sources: string[];
    } | undefined;
    if (prevRecord?.status === 'ignored') continue;

    const notionPageId = notionMap.get(contact.email);
    const isExisting = !!notionPageId;

    // Merge with previously scanned data
    const prev = prevRecord;

    const mergedEventCount = prev
      ? prev.event_count + contact.event_count
      : contact.event_count;
    const mergedFirstSeen = prev && prev.first_seen_date < contact.first_seen_date
      ? prev.first_seen_date
      : contact.first_seen_date;
    const mergedSources = prev
      ? [...new Set([...prev.sources, ...contact.sources])]
      : contact.sources;

    const status = isExisting ? 'existing' : 'new';

    // Upsert to Supabase
    await supabase.from('scanned_contacts').upsert(
      {
        email: contact.email,
        name: contact.name,
        company: contact.company,
        first_seen_date: mergedFirstSeen,
        last_seen_date: contact.last_seen_date,
        event_count: mergedEventCount,
        sources: mergedSources,
        status,
        notion_page_id: notionPageId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );

    // Update Last contact in Notion for existing contacts
    if (isExisting) {
      try {
        await updateNotionLastContact(notionPageId, contact.last_seen_date);
        existingCount++;
      } catch (err) {
        console.error(`[contact-scan] Failed to update Notion for ${contact.email}:`, err);
      }
    } else {
      newCount++;
    }

    resultContacts.push({
      email: contact.email,
      name: contact.name,
      company: contact.company,
      status,
      event_count: mergedEventCount,
      last_seen_date: contact.last_seen_date,
    });
  }

  return {
    new_contacts: newCount,
    updated_existing: existingCount,
    total_events_scanned: totalEvents,
    contacts: resultContacts,
    timestamp: new Date().toISOString(),
    errors: errors.length > 0 ? errors : undefined,
  };
}

/** Create a new contact in Notion Contacts DB */
export async function createNotionContact(contact: {
  name: string;
  email: string;
  company: string | null;
  phone?: string | null;
  last_seen_date: string;
}): Promise<string | null> {
  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDbId = process.env.NOTION_CONTACTS_DB_ID;
  if (!notionApiKey || !notionDbId) throw new Error('Notion not configured');

  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: contact.name } }] },
    'Email Address': { email: contact.email },
    'How we met': { rich_text: [{ text: { content: 'Calendar Invite' } }] },
    'Last contact': { date: { start: contact.last_seen_date } },
  };

  if (contact.company) {
    properties['Company'] = { rich_text: [{ text: { content: contact.company } }] };
  }
  if (contact.phone) {
    properties['Phone Number'] = { phone_number: contact.phone };
  }

  const res = await fetch(`${NOTION_API_URL}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: notionDbId },
      properties,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[contact-scan] Notion create error: ${res.status} ${err}`);
    return null;
  }

  const data = await res.json();
  return data.id;
}

import type { GoogleCalendarEvent } from './google';
import type { GraphEvent } from './microsoft';

// --- Constants ---

const INTERNAL_DOMAINS = ['infinid.id', 'pijar.com', 'infinidgroup.co.id'];

/** Domains that represent resources/rooms, not people */
const RESOURCE_DOMAINS = ['resource.calendar.google.com', 'calendar.google.com'];

const FREE_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'live.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com',
  'proton.me', 'mail.com', 'zoho.com', 'ymail.com',
];

// --- Types ---

export interface ScannedContact {
  email: string;
  name: string | null;
  company: string | null;
  first_seen_date: string; // YYYY-MM-DD
  last_seen_date: string;  // YYYY-MM-DD
  event_count: number;
  sources: string[];
}

// --- Helpers ---

function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function isResourceEmail(email: string): boolean {
  const domain = extractDomain(email);
  return RESOURCE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function isInternalEmail(email: string): boolean {
  if (isResourceEmail(email)) return true; // treat resources as internal (filter out)
  const domain = extractDomain(email);
  return INTERNAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function deriveCompany(email: string): string | null {
  const domain = extractDomain(email);
  if (FREE_EMAIL_PROVIDERS.includes(domain)) return null;

  // Take the first part of domain, capitalize it
  const name = domain.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toDateString(isoOrDate: string): string {
  // Handle various date formats, return YYYY-MM-DD
  return isoOrDate.slice(0, 10);
}

// --- Extractors ---

export function extractContactsFromGoogleEvents(
  events: GoogleCalendarEvent[],
  source: string,
): ScannedContact[] {
  const contactMap = new Map<string, ScannedContact>();

  for (const event of events) {
    if (!event.attendees) continue;

    const eventDate = toDateString(
      event.start.dateTime || event.start.date || new Date().toISOString(),
    );

    for (const attendee of event.attendees) {
      if (attendee.self) continue;

      const email = attendee.email.toLowerCase().trim();
      if (isInternalEmail(email)) continue;

      const existing = contactMap.get(email);
      if (existing) {
        existing.event_count += 1;
        if (eventDate < existing.first_seen_date) existing.first_seen_date = eventDate;
        if (eventDate > existing.last_seen_date) existing.last_seen_date = eventDate;
        if (!existing.sources.includes(source)) existing.sources.push(source);
      } else {
        contactMap.set(email, {
          email,
          name: attendee.displayName || null,
          company: deriveCompany(email),
          first_seen_date: eventDate,
          last_seen_date: eventDate,
          event_count: 1,
          sources: [source],
        });
      }
    }
  }

  return Array.from(contactMap.values());
}

export function extractContactsFromOutlookEvents(
  events: GraphEvent[],
): ScannedContact[] {
  const contactMap = new Map<string, ScannedContact>();
  const source = 'outlook';

  for (const event of events) {
    if (!event.attendees) continue;

    const eventDate = toDateString(event.start.dateTime);

    for (const attendee of event.attendees) {
      const email = attendee.emailAddress.address.toLowerCase().trim();
      if (isInternalEmail(email)) continue;

      const existing = contactMap.get(email);
      if (existing) {
        existing.event_count += 1;
        if (eventDate < existing.first_seen_date) existing.first_seen_date = eventDate;
        if (eventDate > existing.last_seen_date) existing.last_seen_date = eventDate;
        if (!existing.sources.includes(source)) existing.sources.push(source);
      } else {
        contactMap.set(email, {
          email,
          name: attendee.emailAddress.name || null,
          company: deriveCompany(email),
          first_seen_date: eventDate,
          last_seen_date: eventDate,
          event_count: 1,
          sources: [source],
        });
      }
    }
  }

  return Array.from(contactMap.values());
}

/** Merge two contact lists, deduplicating by email */
export function mergeContacts(
  listA: ScannedContact[],
  listB: ScannedContact[],
): ScannedContact[] {
  const map = new Map<string, ScannedContact>();

  for (const contact of [...listA, ...listB]) {
    const existing = map.get(contact.email);
    if (existing) {
      existing.event_count += contact.event_count;
      if (contact.first_seen_date < existing.first_seen_date) {
        existing.first_seen_date = contact.first_seen_date;
      }
      if (contact.last_seen_date > existing.last_seen_date) {
        existing.last_seen_date = contact.last_seen_date;
      }
      // Prefer a real name over null
      if (!existing.name && contact.name) existing.name = contact.name;
      // Merge sources
      for (const s of contact.sources) {
        if (!existing.sources.includes(s)) existing.sources.push(s);
      }
    } else {
      map.set(contact.email, { ...contact });
    }
  }

  return Array.from(map.values());
}

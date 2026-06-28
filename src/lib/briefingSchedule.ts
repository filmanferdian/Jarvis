// Morning briefing scheduled slot.
//
// The automated daily briefing is registered on cron-job.org (Asia/Jakarta tz),
// not in this repo. It fires GET /api/cron/morning-briefing at 07:30 WIB daily.
// That slot time is mirrored here as the single source of truth so that
// on-demand runs can reproduce the most recent scheduled run instead of
// re-scoping to "now".
//
// See src/app/api/cron/morning-briefing/route.ts for the enable/disable toggle.

export const BRIEFING_SLOT_HOUR_WIB = 7;
export const BRIEFING_SLOT_MINUTE_WIB = 30;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * WIB-shifted "now", anchored to the most recent past briefing slot (07:30 WIB).
 *
 * If the current WIB time is before today's slot, this returns a Date 24h
 * earlier, so the whole briefing (coverage date, day-of-week, week window,
 * display date) behaves as the most recent scheduled run rather than
 * re-scoping to the current moment. At or after the slot it equals the plain
 * WIB-shifted now, so the real 07:30 scheduled run is unaffected.
 *
 * The returned Date keeps the codebase convention where the WIB wall clock is
 * encoded in the object's UTC fields (i.e. `now + 7h`), so callers can keep
 * using `.toISOString().split('T')[0]`, `.getDate()`, `.getDay()`, etc.
 */
export function briefingAnchorWib(now: Date = new Date()): Date {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const slotMs = (BRIEFING_SLOT_HOUR_WIB * 60 + BRIEFING_SLOT_MINUTE_WIB) * 60 * 1000;
  // Milliseconds since WIB midnight (wib's UTC clock == WIB wall clock).
  const sinceMidnight =
    wib.getTime() - Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate());
  if (sinceMidnight < slotMs) {
    wib.setTime(wib.getTime() - DAY_MS);
  }
  return wib;
}

/**
 * Human-readable date string ("Monday, June 28, 2026") for an anchored WIB date
 * produced by briefingAnchorWib(). Formats from the date portion only so it
 * never double-shifts the timezone.
 */
export function briefingDateSummary(anchorWib: Date): string {
  const ymd = anchorWib.toISOString().split('T')[0];
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Owner-editable weekly booking slots for bookable services (e.g. Human For Hire),
 * a pure generator that expands them into concrete upcoming slots, and an
 * RFC 5545 invite builder.
 *
 * HOW TO EDIT: change SERVICE_SLOT_CONFIG below. `weekday` is 0=Sunday .. 6=Saturday,
 * `time` is 24h "HH:mm" wall-clock in `timeZone`. DST is handled automatically.
 * `horizonDays` is how far ahead slots are offered; `minLeadHours` is the minimum
 * notice required before a slot starts.
 *
 * Keep this file pure — no fs, no env reads, no server imports — so it loads in the
 * browser bundle and on the server. Intl only, no dependencies.
 */

export interface WeeklySlot {
  /** 0=Sunday .. 6=Saturday */
  weekday: number;
  /** "HH:mm", 24h, in the config timeZone */
  time: string;
}

export interface SlotConfig {
  timeZone: string;
  weekly: WeeklySlot[];
  durationMinutes: number;
  horizonDays: number;
  minLeadHours: number;
}

export interface Slot {
  startMs: number;
  endMs: number;
}

export const SERVICE_SLOT_CONFIG: Record<string, SlotConfig> = {
  'human-for-hire': {
    timeZone: 'America/Los_Angeles',
    weekly: [
      { weekday: 2, time: '18:30' },
      { weekday: 3, time: '18:30' },
      { weekday: 4, time: '18:30' },
    ],
    durationMinutes: 30,
    horizonDays: 21,
    minLeadHours: 24,
  },
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function zonedParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

/** Offset (ms) of `timeZone` from UTC at instant `ms`. */
function tzOffsetMs(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

/** UTC ms of a wall-clock time in `timeZone`. */
function wallToUtcMs(y: number, m: number, d: number, h: number, min: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - tzOffsetMs(guess, timeZone);
  return guess - tzOffsetMs(first, timeZone);
}

/** Concrete slots in (now + minLeadHours, now + horizonDays], ascending. */
export function generateSlots(config: SlotConfig, nowMs: number): Slot[] {
  const earliest = nowMs + config.minLeadHours * HOUR_MS;
  const latest = nowMs + config.horizonDays * DAY_MS;
  const today = zonedParts(nowMs, config.timeZone);
  const out: Slot[] = [];
  for (let i = 0; i <= config.horizonDays + 1; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const weekday = day.getUTCDay();
    for (const w of config.weekly) {
      if (w.weekday !== weekday) continue;
      const [hh, mm] = w.time.split(':').map(Number);
      const startMs = wallToUtcMs(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mm, config.timeZone);
      if (startMs <= earliest || startMs > latest) continue;
      out.push({ startMs, endMs: startMs + config.durationMinutes * 60_000 });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

export interface IcsInput {
  uid: string;
  startMs: number;
  endMs: number;
  summary: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail: string;
  location: string;
}

function icsDate(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold a content line at 75 octets (continuations start with one space). */
function fold(line: string): string[] {
  const enc = new TextEncoder();
  const lines: string[] = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = lines.length === 0 ? 75 : 74;
    if (curBytes + n > limit) {
      lines.push(lines.length === 0 ? cur : ' ' + cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += n;
  }
  lines.push(lines.length === 0 ? cur : ' ' + cur);
  return lines;
}

export function buildIcs(b: IcsInput, nowMs: number = Date.now()): string {
  const raw = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//bilko.run//Human For Hire//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeText(b.uid)}`,
    `DTSTAMP:${icsDate(nowMs)}`,
    `DTSTART:${icsDate(b.startMs)}`,
    `DTEND:${icsDate(b.endMs)}`,
    `SUMMARY:${escapeText(b.summary)}`,
    `DESCRIPTION:${escapeText(b.description)}`,
    `LOCATION:${escapeText(b.location)}`,
    `ORGANIZER;CN=${escapeText(b.organizerName).replace(/[":]/g, '')}:mailto:${b.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${b.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return raw.flatMap(fold).join('\r\n') + '\r\n';
}

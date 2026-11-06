// Pure, Intl-only helpers for the /book page: show slots in the visitor's zone.
export const HOST_TZ = 'America/Los_Angeles';

export interface SlotView {
  wd: string;
  mon: string;
  day: string;
  dateLong: string;
  time: string;
  timeEnd: string;
  tzAbbr: string;
  tomorrow: boolean;
}

export interface WeekGroup<T> {
  label: string;
  slots: T[];
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

function parts(ms: number, tz: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of fmt(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  return out;
}

function clock(p: Record<string, string>): string {
  return `${p.hour}:${p.minute} ${String(p.dayPeriod).toUpperCase()}`;
}

function abbr(ms: number, tz: string): string {
  return parts(ms, tz).timeZoneName ?? '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar day number (days since epoch) of ms as seen in tz. */
function dayNum(ms: number, tz: string): number {
  const p = parts(ms, tz);
  const m = MONTHS.indexOf(p.month);
  return Math.round(Date.UTC(Number(p.year), m, Number(p.day)) / 86400000);
}

function weekStartDay(ms: number, tz: string): number {
  const d = dayNum(ms, tz);
  const dow = new Date(d * 86400000).getUTCDay(); // 0 = Sunday
  return d - ((dow + 6) % 7);
}

export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {
    // fall through
  }
  return HOST_TZ;
}

function safeTz(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return HOST_TZ;
  }
}

export function slotView(startMs: number, endMs: number, tz: string, nowMs: number): SlotView {
  const zone = safeTz(tz);
  const p = parts(startMs, zone);
  const long = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(startMs));
  return {
    wd: p.weekday,
    mon: p.month,
    day: p.day,
    dateLong: long,
    time: clock(p),
    timeEnd: clock(parts(endMs, zone)),
    tzAbbr: p.timeZoneName ?? '',
    tomorrow: dayNum(startMs, zone) === dayNum(nowMs, zone) + 1,
  };
}

export function groupByWeek<T extends { startMs: number }>(
  slots: T[],
  tz: string,
  nowMs: number,
): WeekGroup<T>[] {
  const zone = safeTz(tz);
  const nowWeek = weekStartDay(nowMs, zone);
  const byWeek = new Map<number, T[]>();
  for (const s of slots) {
    const w = weekStartDay(s.startMs, zone);
    const list = byWeek.get(w);
    if (list) list.push(s);
    else byWeek.set(w, [s]);
  }
  return [...byWeek.keys()]
    .sort((a, b) => a - b)
    .map((w) => {
      const diff = Math.round((w - nowWeek) / 7);
      let label: string;
      if (diff === 0) label = 'This week';
      else if (diff === 1) label = 'Next week';
      else if (diff === 2) label = 'Week after';
      else {
        const d = new Date(w * 86400000);
        label = `Week of ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
      }
      return { label, slots: byWeek.get(w)! };
    });
}

const PRESETS: Array<[string, string]> = [
  ['America/Los_Angeles', 'Pacific Time'],
  ['America/Denver', 'Mountain Time'],
  ['America/Chicago', 'Central Time'],
  ['America/New_York', 'Eastern Time'],
  ['Europe/London', 'London'],
  ['Europe/Berlin', 'Berlin'],
  ['Asia/Kolkata', 'India'],
  ['Asia/Singapore', 'Singapore'],
  ['Australia/Sydney', 'Sydney'],
];

export function timeZoneOptions(
  firstStartMs: number,
  detected: string,
  current: string,
): Array<{ value: string; label: string }> {
  const opts = PRESETS.map(([value, name]) => ({
    value,
    label: `${name} (${abbr(firstStartMs, value)})`,
  }));
  const extras: Array<{ value: string; label: string }> = [];
  for (const tz of [current, detected]) {
    if (!tz || opts.some((o) => o.value === tz) || extras.some((o) => o.value === tz)) continue;
    try {
      const name = tz.split('/').pop()!.replace(/_/g, ' ');
      extras.push({ value: tz, label: `${name} (${abbr(firstStartMs, tz)})` });
    } catch {
      // skip invalid zone
    }
  }
  // detected first, then current
  extras.sort((a, b) => (a.value === detected ? -1 : b.value === detected ? 1 : 0));
  return [...extras, ...opts];
}

export function hostNote(firstStartMs: number, tz: string): string | null {
  const host = parts(firstStartMs, HOST_TZ);
  const vis = parts(firstStartMs, safeTz(tz));
  const hostStr = `${clock(host)} ${host.timeZoneName}`;
  const visStr = `${clock(vis)} ${vis.timeZoneName}`;
  if (hostStr === visStr) return null;
  return `That's ${hostStr} for Bilko.`;
}


function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

interface CalArgs {
  title: string;
  startMs: number;
  endMs: number;
  details: string;
}

export function googleCalendarUrl({ title, startMs, endMs, details }: CalArgs): string {
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
    encodeURIComponent(title) +
    '&dates=' + stamp(startMs) + '/' + stamp(endMs) +
    '&details=' + encodeURIComponent(details)
  );
}

export function outlookCalendarUrl({ title, startMs, endMs, details }: CalArgs): string {
  return (
    'https://outlook.live.com/calendar/0/deeplink/compose?subject=' +
    encodeURIComponent(title) +
    '&startdt=' + new Date(startMs).toISOString() +
    '&enddt=' + new Date(endMs).toISOString() +
    '&body=' + encodeURIComponent(details)
  );
}

/** Notice for the Stripe Checkout return URLs that land on /book. Plain text only. */
export function checkoutNotice(search: string): string | null {
  try {
    const q = new URLSearchParams(search);
    if (q.get('offer') === 'bilko-hour' && (q.get('session_id') ?? '') !== '') {
      return 'Payment received. Thank you. Bilko will email you shortly to plan your hours.';
    }
    if (q.get('checkout') === 'cancel') return 'Checkout cancelled. No charge.';
  } catch {
    // malformed input: no notice
  }
  return null;
}

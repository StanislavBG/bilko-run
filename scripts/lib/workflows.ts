/**
 * Pure helpers behind scripts/refresh-workflows.ts: parse the machine's
 * crontab / systemd timers / GitHub Actions schedules into raw schedule
 * entries, turn cron expressions into plain-English cadences, and join the
 * entries against a curated allowlist to produce src/data/workflows.json.
 *
 * Allowlist-only by construction: an entry whose key is not in the allowlist
 * is dropped, so private jobs (and their paths/log locations) never reach the
 * public page. No I/O here — everything is unit-tested from fixture text.
 */

export type ScheduleSource = 'cron' | 'systemd' | 'github-actions';

export interface ScheduleEntry {
  /** Allowlist key: `<project> <job>` from the crontab trailing comment,
   *  `systemd:<unit>.timer`, or `gha:<repo>/<workflow file>`. */
  key: string;
  source: ScheduleSource;
  /** Cron expression (5 fields or `@reboot`); systemd entries use `interval`. */
  cron?: string;
  /** systemd: monotonic interval in minutes (OnUnitActiveSec etc.). */
  intervalMinutes?: number;
  /** systemd: OnCalendar value (e.g. `daily`). */
  calendar?: string;
  /** IANA zone the schedule is evaluated in. */
  tz: string;
}

export interface AllowlistJob {
  /** Jobs sharing an id are merged into one row (e.g. two snapshot tags). */
  id: string;
  project: string;
  name: string;
  desc: string;
  output?: { label: string; href: string };
}

export interface WorkflowGroupMeta {
  slug: string;
  name: string;
  /** Link to the project's /projects card (omit for non-hub groups). */
  href?: string;
  mechanics: string;
}

export interface WorkflowJob {
  id: string;
  name: string;
  desc: string;
  /** One human-readable line per schedule (a job can have several). */
  cadence: string[];
  source: ScheduleSource;
  /** Shortest gap between runs, in minutes; null for boot-only jobs. */
  intervalMinutes: number | null;
  output?: { label: string; href: string };
}

export interface WorkflowGroup extends WorkflowGroupMeta {
  jobs: WorkflowJob[];
}

export interface WorkflowsData {
  generatedAt: string;
  groups: WorkflowGroup[];
}

// ── parsers ─────────────────────────────────────────────────────────────────

const CRON_FIELD = /^[\d*,\-/]+$/;

/**
 * Parses `crontab -l` output, skipping comments (including `#PAUSED…`
 * disabled jobs) and keying each job by its trailing `# <project> <job>` tag.
 * Lines without a tag or with malformed schedule fields are dropped.
 *
 * Every entry is in `systemTz`: Debian/Ubuntu cron (3.0pl1) schedules in the
 * system zone, and a `TZ=` line only changes the commands' environment — see
 * crontab(5). The trader's `TZ=America/New_York` block is still PT-scheduled.
 */
export function parseCrontab(text: string, systemTz: string): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  const tz = systemTz;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) continue; // env assignments (TZ=, PATH=, …)

    const hash = line.lastIndexOf(' # ');
    if (hash < 0) continue;
    const key = line.slice(hash + 3).trim().replace(/\s+/g, ' ');
    if (!/^\S+ \S+$/.test(key)) continue;
    const body = line.slice(0, hash).trim();

    if (body.startsWith('@')) {
      const macro = body.split(/\s+/)[0];
      const cron = MACROS[macro];
      if (cron === undefined) continue;
      out.push({ key, source: 'cron', cron, tz });
      continue;
    }
    const fields = body.split(/\s+/).slice(0, 5);
    if (fields.length < 5 || !fields.every(f => CRON_FIELD.test(f))) continue;
    if (expandField(fields[0], 0, 59) === null || expandField(fields[1], 0, 23) === null) continue;
    out.push({ key, source: 'cron', cron: fields.join(' '), tz });
  }
  return out;
}

const MACROS: Record<string, string> = {
  '@reboot': '@reboot',
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
};

/** Parses a systemd duration like `2min`, `6h`, `1d`, `90s`, `1h 30min`. */
export function parseSystemdDuration(v: string): number | null {
  let total = 0;
  let matched = false;
  for (const m of v.matchAll(/(\d+)\s*(d|days?|h|hours?|hr|min|minutes?|m|s|sec|seconds?)\b/g)) {
    matched = true;
    const n = Number(m[1]);
    const u = m[2];
    if (u.startsWith('d')) total += n * 1440;
    else if (u.startsWith('h')) total += n * 60;
    else if (u === 's' || u.startsWith('sec')) total += n / 60;
    else total += n;
  }
  return matched ? total : null;
}

/** Parses a systemd `.timer` unit's [Timer] section into one entry. */
export function parseSystemdTimer(unitName: string, text: string, tz: string): ScheduleEntry | null {
  const get = (k: string) => new RegExp(`^${k}=(.+)$`, 'm').exec(text)?.[1].trim();
  const key = `systemd:${unitName}`;
  const calendar = get('OnCalendar');
  if (calendar) return { key, source: 'systemd', calendar, tz };
  const mono = get('OnUnitActiveSec') ?? get('OnUnitInactiveSec');
  const minutes = mono ? parseSystemdDuration(mono) : null;
  if (minutes) return { key, source: 'systemd', intervalMinutes: minutes, tz };
  return null;
}

/** Extracts `- cron: '…'` lines from a GitHub Actions workflow (always UTC). */
export function parseGithubSchedule(key: string, yaml: string): ScheduleEntry[] {
  return [...yaml.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map(m => ({
    key, source: 'github-actions' as const, cron: m[1].trim(), tz: 'UTC',
  }));
}

// ── cron field expansion ────────────────────────────────────────────────────

/** Expands one cron field to its sorted value set; null when malformed. */
export function expandField(field: string, min: number, max: number): number[] | null {
  const set = new Set<number>();
  for (const part of field.split(',')) {
    const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
    if (!m) return null;
    let lo = min, hi = max;
    if (m[1] !== '*') {
      lo = Number(m[2]);
      hi = m[3] !== undefined ? Number(m[3]) : (m[4] !== undefined ? max : lo);
    }
    const step = m[4] !== undefined ? Number(m[4]) : 1;
    if (lo < min || hi > max || lo > hi || step < 1) return null;
    for (let v = lo; v <= hi; v += step) set.add(v);
  }
  return [...set].sort((a, b) => a - b);
}

// ── cadence formatting ──────────────────────────────────────────────────────

const TZ_ABBR: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Los_Angeles': 'PT',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  UTC: 'UTC',
  'Etc/UTC': 'UTC',
};

export function tzAbbr(tz: string): string {
  return TZ_ABBR[tz] ?? tz;
}

function clock(h: number, m: number): string {
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** Returns the step when values are evenly spaced across the whole range. */
function uniformStep(values: number[], span: number): number | null {
  if (values.length < 2) return null;
  const step = values[1] - values[0];
  for (let i = 2; i < values.length; i++) if (values[i] - values[i - 1] !== step) return null;
  return values[0] + step * values.length - span === values[0] ? step : null;
}

function isContiguous(values: number[]): boolean {
  return values.every((v, i) => i === 0 || v === values[i - 1] + 1);
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDays(dom: string, dow: string): string | null {
  if (dom !== '*') return null; // day-of-month schedules are not used here
  if (dow === '*') return '';
  const days = expandField(dow, 0, 7)?.map(d => d % 7);
  if (!days) return null;
  const uniq = [...new Set(days)].sort((a, b) => a - b);
  if (uniq.join() === '1,2,3,4,5') return 'weekdays';
  if (uniq.join() === '0,6') return 'weekends';
  return uniq.map(d => DOW_NAMES[d]).join(', ');
}

/**
 * Cron expression → plain English, e.g.
 *   `0,15,30,45 7-12 * * 1-5` → `every 15 min, 7:00am–12:45pm, weekdays`.
 * The zone abbreviation is appended by `formatCadence`.
 */
export function describeCron(cron: string): string | null {
  if (cron === '@reboot') return 'at boot';
  const f = cron.split(/\s+/);
  if (f.length !== 5) return null;
  const mins = expandField(f[0], 0, 59);
  const hours = expandField(f[1], 0, 23);
  const days = formatDays(f[2], f[4]);
  if (!mins || !hours || days === null || f[3] !== '*') return null;

  const allDay = hours.length === 24;
  const hourStep = uniformStep(hours, 24);
  const minStep = uniformStep(mins, 60);
  const parts: string[] = [];

  if (mins.length > 1 && minStep) {
    parts.push(`every ${minStep} min`);
    if (!allDay) {
      if (!isContiguous(hours)) return null;
      parts.push(`${clock(hours[0], mins[0])}–${clock(hours[hours.length - 1], mins[mins.length - 1])}`);
    }
  } else if (mins.length === 1) {
    const m = mins[0];
    if (allDay) parts.push(`hourly at :${String(m).padStart(2, '0')}`);
    else if (hourStep && hourStep > 1 && hours.length > 3) parts.push(`every ${hourStep}h at :${String(m).padStart(2, '0')}`);
    else if (hours.length > 3 && isContiguous(hours)) parts.push(`hourly at :${String(m).padStart(2, '0')}, ${clock(hours[0], m)}–${clock(hours[hours.length - 1], m)}`);
    else if (hours.length > 3) parts.push(`${hours.length}×/day, ${clock(hours[0], m)}–${clock(hours[hours.length - 1], m)}`);
    else parts.push(`${days ? '' : 'daily '}at ${hours.map(h => clock(h, m)).join(', ')}`);
  } else {
    return null;
  }
  if (days) parts.push(days);
  return parts.join(', ');
}

function describeInterval(minutes: number): string {
  if (minutes < 60) return `every ${Math.round(minutes)} min`;
  if (minutes % 1440 === 0) return minutes === 1440 ? 'daily' : `every ${minutes / 1440} days`;
  if (minutes % 60 === 0) return `every ${minutes / 60}h`;
  return `every ${Math.round(minutes)} min`;
}

const CALENDAR: Record<string, string> = {
  hourly: 'hourly',
  daily: 'daily at midnight',
  weekly: 'weekly, Mon midnight',
};

/** One display line for an entry, with its zone abbreviation. */
export function formatCadence(e: ScheduleEntry): string | null {
  if (e.cron === '@reboot') return 'at boot';
  let text: string | null = null;
  if (e.cron) text = describeCron(e.cron);
  else if (e.intervalMinutes) return describeInterval(e.intervalMinutes);
  else if (e.calendar) text = CALENDAR[e.calendar] ?? null;
  return text === null ? null : `${text} ${tzAbbr(e.tz)}`;
}

/** Shortest gap between consecutive fires, in minutes (null: boot-only). */
export function minIntervalMinutes(e: ScheduleEntry): number | null {
  if (e.intervalMinutes) return e.intervalMinutes;
  if (e.calendar) return e.calendar === 'hourly' ? 60 : e.calendar === 'weekly' ? 10080 : 1440;
  if (!e.cron || e.cron === '@reboot') return null;
  const f = e.cron.split(/\s+/);
  const mins = expandField(f[0], 0, 59);
  const hours = expandField(f[1], 0, 23);
  if (!mins || !hours) return null;
  const times = hours.flatMap(h => mins.map(m => h * 60 + m));
  if (times.length === 1) return 1440;
  let best = times[0] + 1440 - times[times.length - 1];
  for (let i = 1; i < times.length; i++) best = Math.min(best, times[i] - times[i - 1]);
  return best;
}

// ── join ────────────────────────────────────────────────────────────────────

/**
 * Joins schedule entries against the allowlist. Unknown keys and entries
 * whose cadence can't be described are dropped (never emitted raw). Groups
 * keep `groups` order; groups with no surviving jobs are omitted.
 */
export function buildWorkflows(
  entries: readonly ScheduleEntry[],
  allowlist: Readonly<Record<string, AllowlistJob>>,
  groups: readonly WorkflowGroupMeta[],
  generatedAt: string,
): WorkflowsData {
  const jobs = new Map<string, WorkflowJob & { project: string }>();
  for (const e of entries) {
    const a = Object.prototype.hasOwnProperty.call(allowlist, e.key) ? allowlist[e.key] : undefined;
    if (!a) continue;
    const line = formatCadence(e);
    if (!line) continue;
    const interval = minIntervalMinutes(e);
    const existing = jobs.get(a.id);
    if (existing) {
      if (!existing.cadence.includes(line)) existing.cadence.push(line);
      if (interval !== null) {
        existing.intervalMinutes = existing.intervalMinutes === null ? interval : Math.min(existing.intervalMinutes, interval);
      }
      continue;
    }
    jobs.set(a.id, {
      id: a.id,
      project: a.project,
      name: a.name,
      desc: a.desc,
      cadence: [line],
      source: e.source,
      intervalMinutes: interval,
      ...(a.output ? { output: a.output } : {}),
    });
  }

  const out: WorkflowGroup[] = [];
  for (const g of groups) {
    const groupJobs = [...jobs.values()]
      .filter(j => j.project === g.slug)
      .map(({ project: _project, ...j }) => j)
      .sort((a, b) => (a.intervalMinutes ?? Infinity) - (b.intervalMinutes ?? Infinity));
    if (groupJobs.length) out.push({ ...g, jobs: groupJobs });
  }
  return { generatedAt, groups: out };
}

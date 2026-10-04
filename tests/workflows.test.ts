import { describe, it, expect } from 'vitest';
import {
  parseCrontab, parseSystemdTimer, parseGithubSchedule, describeCron, formatCadence,
  minIntervalMinutes, buildWorkflows, expandField, type AllowlistJob, type WorkflowGroupMeta,
} from '../scripts/lib/workflows.js';
import { WORKFLOW_ALLOWLIST } from '../scripts/workflows-allowlist.js';
import { orderGroups, workflowStats, type WorkflowGroup } from '../src/data/workflowsView.js';

const PT = 'America/Los_Angeles';

const CRONTAB = `
# --- trader ---
0 */6 * * * /home/u/sst/snapshot.sh >> /tmp/snapshot.log 2>&1 # sst snapshot
#PAUSED-INACTIVE# 47 * * * * /home/u/sst/publish.sh # sst publish
@reboot /home/u/sst/catchup.sh >> /home/u/log 2>&1 # sst catchup
TZ=America/New_York
PATH=/usr/bin:/bin
0,15,30,45 7-12 * * 1-5 /home/u/sst/tick.sh # sst tick
7-59/15 * * * * /home/u/burrow/pipeline-cron.sh gather # burrow pipe:gather
30 9 * * * /home/u/private/email.sh # me email-agent
61 * * * * /bad/minute.sh # sst bad-minute
* * * /too/few/fields.sh # sst few
0 9 * * * /no/tag.sh
`;

describe('parseCrontab', () => {
  const entries = parseCrontab(CRONTAB, PT);
  const keys = entries.map(e => e.key);

  it('keys jobs by trailing tag and skips comments, untagged and malformed lines', () => {
    expect(keys).toEqual(['sst snapshot', 'sst catchup', 'sst tick', 'burrow pipe:gather', 'me email-agent']);
  });

  it('schedules in the system zone even after a TZ= line (Debian cron semantics)', () => {
    expect(entries.every(e => e.tz === PT)).toBe(true);
  });

  it('keeps @reboot as a macro', () => {
    expect(entries.find(e => e.key === 'sst catchup')?.cron).toBe('@reboot');
  });
});

describe('expandField', () => {
  it('handles steps, ranges, lists and rejects out-of-range values', () => {
    expect(expandField('7-59/15', 0, 59)).toEqual([7, 22, 37, 52]);
    expect(expandField('*/6', 0, 23)).toEqual([0, 6, 12, 18]);
    expect(expandField('1,3-4', 0, 6)).toEqual([1, 3, 4]);
    expect(expandField('61', 0, 59)).toBeNull();
    expect(expandField('5-2', 0, 59)).toBeNull();
  });
});

describe('describeCron / formatCadence', () => {
  it.each([
    ['*/2 * * * *', 'every 2 min'],
    ['7-59/15 * * * *', 'every 15 min'],
    ['14,44 * * * *', 'every 30 min'],
    ['25 * * * *', 'hourly at :25'],
    ['45 */4 * * *', 'every 4h at :45'],
    ['25 7,11,15,19,23 * * *', '5×/day, 7:25am–11:25pm'],
    ['0 9,21 * * *', 'daily at 9:00am, 9:00pm'],
    ['30 4 * * *', 'daily at 4:30am'],
    ['0,15,30,45 7-12 * * 1-5', 'every 15 min, 7:00am–12:45pm, weekdays'],
    ['29 6-12 * * 1-5', 'hourly at :29, 6:29am–12:29pm, weekdays'],
    ['0 9 * * 6', 'at 9:00am, Sat'],
  ])('%s → %s', (cron, text) => {
    expect(describeCron(cron)).toBe(text);
  });

  it('returns null for shapes it cannot describe instead of guessing', () => {
    expect(describeCron('0 0 1 * *')).toBeNull();
    expect(describeCron('0 0 * 6 *')).toBeNull();
  });

  it('appends the zone abbreviation; boot and intervals are zone-free', () => {
    expect(formatCadence({ key: 'k', source: 'cron', cron: '30 4 * * *', tz: PT })).toBe('daily at 4:30am PT');
    expect(formatCadence({ key: 'k', source: 'github-actions', cron: '0 9 * * *', tz: 'UTC' })).toBe('daily at 9:00am UTC');
    expect(formatCadence({ key: 'k', source: 'cron', cron: '@reboot', tz: PT })).toBe('at boot');
    expect(formatCadence({ key: 'k', source: 'systemd', intervalMinutes: 360, tz: PT })).toBe('every 6h');
  });
});

describe('minIntervalMinutes', () => {
  it('finds the shortest gap including the wrap across midnight', () => {
    expect(minIntervalMinutes({ key: 'k', source: 'cron', cron: '0 9,21 * * *', tz: PT })).toBe(720);
    expect(minIntervalMinutes({ key: 'k', source: 'cron', cron: '0,15,30,45 7-12 * * 1-5', tz: PT })).toBe(15);
    expect(minIntervalMinutes({ key: 'k', source: 'cron', cron: '30 4 * * *', tz: PT })).toBe(1440);
    expect(minIntervalMinutes({ key: 'k', source: 'cron', cron: '@reboot', tz: PT })).toBeNull();
  });
});

describe('systemd + GitHub Actions parsers', () => {
  it('reads monotonic and calendar timers', () => {
    expect(parseSystemdTimer('a.timer', '[Timer]\nOnBootSec=2min\nOnUnitActiveSec=2min\n', PT)?.intervalMinutes).toBe(2);
    expect(parseSystemdTimer('b.timer', '[Timer]\nOnCalendar=daily\nPersistent=true\n', PT)?.calendar).toBe('daily');
    expect(parseSystemdTimer('c.timer', '[Timer]\nOnBootSec=5min\n', PT)).toBeNull();
  });

  it('extracts schedule crons as UTC', () => {
    const e = parseGithubSchedule('gha:x/pages.yml', "on:\n  schedule:\n    # daily\n    - cron: '0 9 * * *'\n");
    expect(e).toEqual([{ key: 'gha:x/pages.yml', source: 'github-actions', cron: '0 9 * * *', tz: 'UTC' }]);
  });
});

describe('buildWorkflows', () => {
  const allow: Record<string, AllowlistJob> = {
    'sst tick': { id: 'tick', project: 'sst', name: 'Tick', desc: 'd' },
    'sst snapshot': { id: 'snap', project: 'sst', name: 'Snapshot', desc: 'd' },
    'sst catchup': { id: 'catchup', project: 'sst', name: 'Catch-up', desc: 'd' },
    'burrow pipe:gather': { id: 'gather', project: 'burrow', name: 'Gather', desc: 'd' },
  };
  const groups: WorkflowGroupMeta[] = [
    { slug: 'sst', name: 'SST', mechanics: 'm' },
    { slug: 'empty', name: 'Empty', mechanics: 'm' },
    { slug: 'burrow', name: 'Burrow', mechanics: 'm' },
  ];
  const extra = '0 6 * * 1-5 /x # sst tick\n';
  const data = buildWorkflows(parseCrontab(CRONTAB + extra, PT), allow, groups, '2026-10-04T00:00:00Z');
  const json = JSON.stringify(data);

  it('never emits non-allowlisted jobs, commands or paths', () => {
    expect(json).not.toContain('email');
    expect(json).not.toContain('/home/');
    expect(json).not.toContain('.sh');
  });

  it('merges repeated tags into one job with several cadence lines, fastest first', () => {
    const sst = data.groups.find(g => g.slug === 'sst')!;
    expect(sst.jobs.map(j => j.id)).toEqual(['tick', 'snap', 'catchup']);
    expect(sst.jobs[0].cadence).toEqual(['every 15 min, 7:00am–12:45pm, weekdays PT', 'at 6:00am, weekdays PT']);
    expect(sst.jobs[0].intervalMinutes).toBe(15);
  });

  it('omits groups with no jobs and keeps group order', () => {
    expect(data.groups.map(g => g.slug)).toEqual(['sst', 'burrow']);
  });

  it('ignores inherited object keys in the allowlist', () => {
    const d = buildWorkflows([{ key: 'constructor', source: 'cron', cron: '* * * * *', tz: PT }], allow, groups, 'x');
    expect(d.groups).toEqual([]);
  });
});

describe('real allowlist', () => {
  it('excludes private jobs', () => {
    const keys = Object.keys(WORKFLOW_ALLOWLIST).join(' ');
    for (const banned of ['email-agent', 'bills-collector', 'sigma']) expect(keys).not.toContain(banned);
  });
});

describe('workflowsView', () => {
  const job = (id: string, intervalMinutes: number | null) =>
    ({ id, name: id, desc: '', cadence: [], source: 'cron' as const, intervalMinutes });
  const groups: WorkflowGroup[] = [
    { slug: 'burrow', name: 'B', mechanics: '', jobs: [job('a', 2), job('b', null)] },
    { slug: 'trader', name: 'T', mechanics: '', jobs: [job('c', 15)] },
    { slug: 'sm', name: 'S', mechanics: '', jobs: [job('d', 1440)] },
  ];
  const pub = new Set(['sm', 'other', 'trader']);

  it('orders hub groups by the public slug order, others after', () => {
    expect(orderGroups(groups, pub).map(g => g.slug)).toEqual(['sm', 'trader', 'burrow']);
  });

  it('derives stats from the data', () => {
    expect(workflowStats(groups, pub)).toEqual({ jobCount: 4, projectCount: 2, fastest: '2min' });
  });
});

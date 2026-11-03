import { describe, it, expect } from 'vitest';
import {
  detectTimeZone, slotView, groupByWeek, timeZoneOptions, hostNote,
  googleCalendarUrl, outlookCalendarUrl,
} from '../src/lib/bookingView';

const H = 3600000;
// Tue 2026-11-03 18:30 PST = 2026-11-04T02:30Z
const START = Date.UTC(2026, 10, 4, 2, 30);
const END = START + H;
const NOW = Date.UTC(2026, 10, 2, 20, 0); // Mon Nov 2 noon PST

describe('slotView', () => {
  it('Los Angeles', () => {
    expect(slotView(START, END, 'America/Los_Angeles', NOW)).toEqual({
      wd: 'Tue', mon: 'Nov', day: '3', dateLong: 'Tuesday, November 3',
      time: '6:30 PM', timeEnd: '7:30 PM', tzAbbr: 'PST', tomorrow: true,
    });
  });
  it('Berlin shifts time and day-of-week', () => {
    const v = slotView(START, END, 'Europe/Berlin', NOW);
    expect(v.wd).toBe('Wed');
    expect(v.day).toBe('4');
    expect(v.time).toBe('3:30 AM');
    expect(v.tomorrow).toBe(false);
  });
  it('Sydney shifts to next day', () => {
    const v = slotView(START, END, 'Australia/Sydney', NOW);
    expect(v.dateLong).toBe('Wednesday, November 4');
    expect(v.time).toBe('1:30 PM');
  });
  it('tomorrow is calendar based in tz', () => {
    expect(slotView(START, END, 'America/Los_Angeles', START - 2 * H).tomorrow).toBe(false);
    expect(slotView(START, END, 'America/Los_Angeles', START - 30 * H).tomorrow).toBe(true);
  });
});

describe('groupByWeek', () => {
  const at = (m: number, d: number) => ({ startMs: Date.UTC(2026, m, d + 1, 2, 30) }); // 18:30 PST on d
  it('splits at Sunday/Monday and labels', () => {
    const g = groupByWeek([at(10, 3), at(10, 5), at(10, 8), at(10, 10), at(10, 17), at(10, 24)], 'America/Los_Angeles', NOW);
    expect(g.map((x) => x.label)).toEqual(['This week', 'Next week', 'Week after', 'Week of Nov 23']);
    expect(g[0].slots).toHaveLength(3);
    expect(g[1].slots).toHaveLength(1);
  });
  it('Sunday belongs to the prior week', () => {
    const sun = at(10, 8); // Sun Nov 8
    const mon = at(10, 9);
    const g = groupByWeek([sun, mon], 'America/Los_Angeles', NOW);
    expect(g.map((x) => x.label)).toEqual(['This week', 'Next week']);
  });
  it('handles DST change week (Nov 1 2026)', () => {
    const now = Date.UTC(2026, 9, 28, 20); // Wed Oct 28
    const g = groupByWeek([at(9, 29), at(10, 3)], 'America/Los_Angeles', now);
    expect(g.map((x) => x.label)).toEqual(['This week', 'Next week']);
  });
  it('omits empty weeks', () => {
    expect(groupByWeek([], 'America/Los_Angeles', NOW)).toEqual([]);
  });
});

describe('timeZoneOptions', () => {
  it('presets labelled', () => {
    const o = timeZoneOptions(START, 'America/Los_Angeles', 'America/Los_Angeles');
    expect(o).toHaveLength(9);
    expect(o[0]).toEqual({ value: 'America/Los_Angeles', label: 'Pacific Time (PST)' });
  });
  it('prepends non-preset detected/current', () => {
    const o = timeZoneOptions(START, 'America/Port_of_Spain', 'Asia/Tokyo');
    expect(o[0].label).toMatch(/^Port of Spain \(/);
    expect(o[1].label).toMatch(/^Tokyo \(/);
    expect(o).toHaveLength(11);
  });
});

describe('detectTimeZone / hostNote', () => {
  it('returns a usable zone', () => {
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: detectTimeZone() })).not.toThrow();
  });
  it('falls back when Intl zone is invalid', () => {
    const orig = Intl.DateTimeFormat;
    const spy = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      return { ...spy.call(this), timeZone: 'Not/AZone' };
    };
    try { expect(detectTimeZone()).toBe('America/Los_Angeles'); }
    finally { Intl.DateTimeFormat.prototype.resolvedOptions = spy; expect(Intl.DateTimeFormat).toBe(orig); }
  });
  it('hostNote', () => {
    expect(hostNote(START, 'America/Los_Angeles')).toBeNull();
    expect(hostNote(START, 'Europe/Berlin')).toBe("That's 6:30 PM PST for Bilko.");
  });
});

describe('calendar urls', () => {
  const a = { title: 'Call & chat', startMs: START, endMs: END, details: 'a b' };
  it('google', () => {
    expect(googleCalendarUrl(a)).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Call%20%26%20chat&dates=20261104T023000Z/20261104T033000Z&details=a%20b');
  });
  it('outlook', () => {
    expect(outlookCalendarUrl(a)).toBe(
      'https://outlook.live.com/calendar/0/deeplink/compose?subject=Call%20%26%20chat&startdt=2026-11-04T02:30:00.000Z&enddt=2026-11-04T03:30:00.000Z&body=a%20b');
  });
});

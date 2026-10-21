import { describe, expect, it } from 'vitest';
import { SERVICE_SLOT_CONFIG, buildIcs, generateSlots } from '../shared/service-slots';

const cfg = SERVICE_SLOT_CONFIG['human-for-hire'];
const NOW = Date.UTC(2026, 9, 27);

describe('generateSlots', () => {
  it('yields 3 slots/week over the 21-day horizon, ascending', () => {
    const slots = generateSlots(cfg, NOW);
    expect(slots).toHaveLength(9);
    for (let i = 1; i < slots.length; i++) expect(slots[i].startMs).toBeGreaterThan(slots[i - 1].startMs);
    expect(slots[0].endMs - slots[0].startMs).toBe(90 * 60_000);
  });

  it('excludes slots inside the minimum lead time', () => {
    // 10-27 18:30 PDT = 10-28 01:30Z; now one hour before it
    const now = Date.UTC(2026, 9, 28, 0, 30);
    const slots = generateSlots(cfg, now);
    expect(slots.every((s) => s.startMs > now + 24 * 3600_000)).toBe(true);
    expect(slots.some((s) => s.startMs === Date.UTC(2026, 9, 28, 1, 30))).toBe(false);
  });

  it('converts PT wall time across DST', () => {
    const starts = generateSlots(cfg, NOW).map((s) => s.startMs);
    expect(starts).toContain(Date.UTC(2026, 9, 29, 1, 30)); // Wed 10-28 PDT
    expect(starts).toContain(Date.UTC(2026, 10, 4, 2, 30)); // Tue 11-03 PST
  });
});

describe('buildIcs', () => {
  const base = {
    uid: 'abc@bilko.run',
    startMs: Date.UTC(2026, 10, 4, 2, 30),
    endMs: Date.UTC(2026, 10, 4, 4, 0),
    summary: 'Call, with; stuff',
    description: 'line1\nline2 back\\slash ' + 'x'.repeat(200),
    organizerName: 'Bilko',
    organizerEmail: 'BilkoBibitkov2000@gmail.com',
    attendeeEmail: 'buyer@example.com',
    location: 'Zoom',
  };

  it('builds a CRLF VCALENDAR with escaping and folding', () => {
    const ics = buildIcs(base);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('DTSTART:20261104T023000Z');
    expect(ics).toContain('DTEND:20261104T040000Z');
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain('SUMMARY:Call\\, with\; stuff');
    expect(ics).toContain('line1\\nline2 back\\\\slash');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('never leaks the owner real name; persona address allowed', () => {
    const ics = buildIcs(base);
    expect(ics.replace(/\r\n /g, '').toLowerCase()).not.toContain('stanislav');
    expect(ics.replace(/\r\n /g, '')).toContain('BilkoBibitkov2000@gmail.com');
  });
});

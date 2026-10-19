import { describe, expect, it } from 'vitest';
import { donutSegments } from '../src/pages/admin/command/AudienceModule.js';

type Row = { browser: string | null; hits: number };
const rows = (...r: [string | null, number][]): Row[] => r.map(([browser, hits]) => ({ browser, hits }));

describe('donutSegments', () => {
  it('merges a real "other" row with the synthetic bucket into one', () => {
    const d = donutSegments(
      rows(['chrome', 39], ['safari', 20], ['firefox', 10], ['edge', 5], ['brave', 3], ['other', 23]),
      'browser',
    );
    expect(d.segments.filter(s => s.label === 'other')).toHaveLength(1);
    expect(d.segments.find(s => s.label === 'other')?.value).toBe(26);
    expect(d.segments.reduce((a, s) => a + s.value, 0)).toBe(100);
  });

  it('merges case-insensitive and empty/null keys into other', () => {
    const d = donutSegments(rows(['chrome', 10], ['Other', 2], ['', 3], [null, 1]), 'browser');
    expect(d.segments.map(s => s.label)).toEqual(['chrome', 'other']);
    expect(d.segments[1].value).toBe(6);
  });

  it('centers the largest named segment when other is biggest', () => {
    const d = donutSegments(rows(['chrome', 39], ['other', 53], ['safari', 8]), 'browser');
    expect(d.topLabel).toBe('chrome');
    expect(d.topPct).toBe(39);
  });

  it('handles all-other input', () => {
    const d = donutSegments(rows(['other', 5], [null, 5]), 'browser');
    expect(d.segments).toHaveLength(1);
    expect(d.segments[0]).toMatchObject({ label: 'other', value: 10 });
    expect(d.topLabel).toBe('');
    expect(d.topPct).toBe(0);
  });

  it('handles empty input', () => {
    const d = donutSegments([] as Row[], 'browser');
    expect(d).toEqual({ segments: [], topPct: 0, topLabel: '' });
  });
});

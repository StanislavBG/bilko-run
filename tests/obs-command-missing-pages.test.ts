import { describe, it, expect } from 'vitest';
import { notFoundRows } from '../src/pages/admin/command/TrafficModule.js';
import type { TrafficData } from '../src/pages/admin/command/types.js';

const base = (extra: Partial<TrafficData> = {}): TrafficData => ({
  days: 7,
  totals: { hits: 100, visitors: 10, botHits: 0, notFound: 0, clicks: 0 },
  byDay: [], topPages: [], topReferrers: [], bySlug: [], byCountry: [], byDevice: [], byBrowser: [],
  topClicks: [], recent: [], visitors: [], earliestDate: null, generatedAt: 0,
  ...extra,
});

const row = (path: string, hits: number, botHits: number) => ({ path, hits, botHits, visitors: 1 });

describe('notFoundRows', () => {
  it('returns [] when notFoundPaths is missing or empty', () => {
    expect(notFoundRows(base())).toEqual([]);
    expect(notFoundRows(base({ notFoundPaths: [] }))).toEqual([]);
  });

  it('caps at 8 rows in API order', () => {
    const paths = Array.from({ length: 12 }, (_, i) => row(`/p${i}`, 20 - i, 0));
    const rows = notFoundRows(base({ notFoundPaths: paths }));
    expect(rows).toHaveLength(8);
    expect(rows.map(r => r.path)).toEqual(['/p0', '/p1', '/p2', '/p3', '/p4', '/p5', '/p6', '/p7']);
  });

  it('computes humanHits = hits - botHits and keeps botHits', () => {
    const rows = notFoundRows(base({ notFoundPaths: [row('/.env', 9, 7), row('/old-link', 3, 0)] }));
    expect(rows).toEqual([
      expect.objectContaining({ path: '/.env', hits: 9, botHits: 7, humanHits: 2 }),
      expect.objectContaining({ path: '/old-link', hits: 3, botHits: 0, humanHits: 3 }),
    ]);
  });

  it('cuts paths longer than 48 characters with an ellipsis', () => {
    const long = '/' + 'a'.repeat(60);
    const exact = '/' + 'b'.repeat(47);
    const rows = notFoundRows(base({ notFoundPaths: [row(long, 1, 1), row(exact, 1, 0)] }));
    expect(rows[0].path.length).toBe(48);
    expect(rows[0].path.endsWith('…')).toBe(true);
    expect(rows[0].path.startsWith('/aaaa')).toBe(true);
    expect(rows[1].path).toBe(exact);
  });
});

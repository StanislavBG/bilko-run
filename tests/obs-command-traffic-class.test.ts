import { describe, it, expect } from 'vitest';
import { classRows } from '../src/pages/admin/command/TrafficModule.js';
import { classBadge } from '../src/pages/admin/command/KpiStrip.js';
import type { TrafficData } from '../src/pages/admin/command/types.js';

const base = (extra: Partial<TrafficData> = {}): TrafficData => ({
  days: 7,
  totals: { hits: 100, visitors: 10, botHits: 0, notFound: 0, clicks: 0 },
  byDay: [], topPages: [], topReferrers: [], bySlug: [], byCountry: [], byDevice: [], byBrowser: [],
  topClicks: [], recent: [], visitors: [], earliestDate: null, generatedAt: 0,
  ...extra,
});

describe('classRows', () => {
  it('orders by hits, labels classes, and computes frac against the max', () => {
    const rows = classRows(base({
      byClass: [
        { class: 'ai_user_agent', hits: 10, visitors: 2 },
        { class: 'human', hits: 40, visitors: 8 },
        { class: 'script', hits: 20, visitors: 1 },
        { class: 'search_crawler', hits: 5, visitors: 1 },
        { class: 'ai_crawler', hits: 2, visitors: 1 },
        { class: 'api_client', hits: 1, visitors: 1 },
      ],
      topPagesByClass: [
        { path: '/a', class: 'human', hits: 30, visitors: 6 },
        { path: '/b', class: 'human', hits: 10, visitors: 2 },
        { path: '/mcp', class: 'api_client', hits: 1, visitors: 1 },
      ],
    }));
    expect(rows.map(r => r.name)).toEqual([
      'Human', 'Script', 'AI agent (for a person)', 'Search crawler', 'AI crawler', 'API/MCP client',
    ]);
    expect(rows[0].frac).toBe(1);
    expect(rows[1].frac).toBe(0.5);
    expect(rows[0].vals).toEqual(['40', '8']);
    expect(rows[0].top).toBe('/a');
    expect(rows[5].top).toBe('/mcp');
    expect(rows[1].top).toBeNull();
  });

  it('returns nothing when byClass is missing or empty', () => {
    expect(classRows(base())).toEqual([]);
    expect(classRows(base({ byClass: [] }))).toEqual([]);
  });

  it('survives all-zero hits', () => {
    expect(classRows(base({ byClass: [{ class: 'human', hits: 0, visitors: 0 }] }))[0].frac).toBe(0);
  });
});

describe('classBadge', () => {
  it('maps classes to short tags', () => {
    expect(classBadge({ visitorClass: 'ai_user_agent', isBot: true })).toBe('AI');
    expect(classBadge({ visitorClass: 'ai_crawler', isBot: true })).toBe('CRAWL');
    expect(classBadge({ visitorClass: 'search_crawler', isBot: true })).toBe('SEARCH');
    expect(classBadge({ visitorClass: 'api_client', isBot: false })).toBe('API');
    expect(classBadge({ visitorClass: 'script', isBot: true })).toBe('SCRIPT');
  });
  it('falls back to BOT for isBot without a class, null for humans', () => {
    expect(classBadge({ isBot: true })).toBe('BOT');
    expect(classBadge({ visitorClass: 'human', isBot: false })).toBeNull();
    expect(classBadge({ isBot: false })).toBeNull();
  });
});

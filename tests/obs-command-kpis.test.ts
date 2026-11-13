import { describe, it, expect } from 'vitest';
import { deriveKpis, deriveStatus, filterQuery } from '../src/pages/admin/command/useCommandData.js';
import type {
  TrafficData, FlowsData, EgressData, BlogCadence, ObservabilityData, AppHealth,
} from '../src/pages/admin/command/types.js';

const traffic = (over: Partial<TrafficData['totals']> = {}, extra: Partial<TrafficData> = {}): TrafficData => ({
  days: 7,
  totals: { hits: 900, visitors: 120, botHits: 100, notFound: 0, clicks: 40, ...over },
  byDay: [{ date: 'd1', hits: 5, visitors: 1 }, { date: 'd2', hits: 9, visitors: 2 }],
  topPages: [], topReferrers: [], bySlug: [],
  byCountry: [{ country: 'US', hits: 5 }, { country: 'DE', hits: 2 }],
  byDevice: [], byBrowser: [],
  topClicks: [{ path: '/', tag: 'a', label: 'Pricing', href: null, clicks: 9, visitors: 3 }],
  recent: [], visitors: [], earliestDate: null, generatedAt: 0,
  ...extra,
});
const app = (name: string, sessions: number, errors: number): AppHealth => ({
  app: name, sessions, views: 0, clicks: 0, events: 0, errors, error_sessions: 0, last_seen_ms: 0,
});
const flows = (apps: AppHealth[]): FlowsData => ({ apps, flows: [] });
const egress = (total: number, slugs: number[]): EgressData => ({
  rows: [], totalBytes: total, assets: [], earliestDate: null, days: 7, generatedAt: 0,
  bySlug: slugs.map((bytes, i) => ({ slug: `s${i}`, requests: 1, bytes, bytesPerRequest: bytes })),
});
const blog = (status: BlogCadence['status'], gap: number | null = 3): BlogCadence => ({
  lastPublishedAt: null, gapDays: gap, targetUpperDays: 5, catchupTriggerDays: 9, status,
});
const byLabel = (t: ReturnType<typeof deriveKpis>, label: string) => t.find((x) => x.label.startsWith(label))!;

describe('deriveKpis', () => {
  it('returns 9 tiles', () => {
    expect(deriveKpis(traffic(), flows([]), egress(0, []), blog('ok'))).toHaveLength(9);
  });

  it('computes bot % of hits+bot and the hits sparkline', () => {
    const k = deriveKpis(traffic(), null, null, null);
    expect(byLabel(k, 'BOT').sub).toBe('10% of hits');
    expect(byLabel(k, 'BOT').tone).toBe('amber');
    expect(byLabel(k, 'HITS').spark).toEqual([5, 9]);
    expect(byLabel(k, 'UNIQUE').sub).toBe('2 countries');
    expect(byLabel(k, 'CLICKS').sub).toBe('top · Pricing');
  });

  it('colors 404s by count', () => {
    expect(byLabel(deriveKpis(traffic(), null, null, null), '404').sub).toBe('clean');
    const k = byLabel(deriveKpis(traffic({ notFound: 3 }), null, null, null), '404');
    expect(k.tone).toBe('red');
  });

  it('sums sessions/errors and names the top erroring app', () => {
    const k = deriveKpis(null, flows([app('a', 4, 1), app('b', 6, 7)]), null, null);
    expect(byLabel(k, 'APP SESSIONS').value).toBe('10');
    expect(byLabel(k, 'APP SESSIONS').sub).toBe('2 apps');
    const e = byLabel(k, 'ERRORS');
    expect(e.value).toBe('8');
    expect(e.tone).toBe('red');
    expect(e.sub).toContain('b');
  });

  it('shows top slug share of egress, amber above 50%', () => {
    const hi = byLabel(deriveKpis(null, null, egress(100, [60, 40]), null), 'EGRESS');
    expect(hi.sub).toBe('60% one app');
    expect(hi.tone).toBe('amber');
    const lo = byLabel(deriveKpis(null, null, egress(100, [50, 50]), null), 'EGRESS');
    expect(lo.tone).not.toBe('amber');
  });

  it('colors blog cadence by status', () => {
    expect(byLabel(deriveKpis(null, null, null, blog('ok')), 'BLOG').tone).toBe('green');
    expect(byLabel(deriveKpis(null, null, null, blog('warn')), 'BLOG').tone).toBe('amber');
    expect(byLabel(deriveKpis(null, null, null, blog('critical')), 'BLOG').tone).toBe('red');
    expect(byLabel(deriveKpis(null, null, null, blog('ok', 3)), 'BLOG').value).toBe('3d');
  });

  it('tolerates all-null input with em-dash values', () => {
    const k = deriveKpis(null, null, null, null);
    expect(k).toHaveLength(9);
    for (const t of k) expect(t.value).toBe('—');
  });
});

describe('filterQuery', () => {
  it('is empty when nothing is excluded', () => {
    expect(filterQuery({ mine: false, bots: false })).toBe('');
    expect(filterQuery(undefined)).toBe('');
  });
  it('sends mine=exclude when MINE is excluded', () => {
    expect(filterQuery({ mine: true, bots: false })).toBe('&mine=exclude');
  });
  it('sends bots=exclude when BOT is excluded', () => {
    expect(filterQuery({ mine: false, bots: true })).toBe('&bots=exclude');
  });
  it('sends both params when both are excluded', () => {
    expect(filterQuery({ mine: true, bots: true })).toBe('&mine=exclude&bots=exclude');
  });
});

describe('deriveKpis with the server filters echo', () => {
  const echo = (mine: 'include' | 'exclude', bots: 'include' | 'exclude', mineHits = 0) => traffic({}, { filters: { mine, bots, mineHits } });
  const F = flows([app('a', 4, 1), app('b', 6, 7)]);
  const E = egress(100, [60, 40]);
  const B = blog('ok');
  // A caller that still hands over the local toggles: the labels must ignore them.
  const withLocal = deriveKpis as unknown as (...a: unknown[]) => ReturnType<typeof deriveKpis>;

  it('leaves every tile unchanged when the echo excludes nothing', () => {
    const base = deriveKpis(traffic(), F, E, B);
    expect(deriveKpis(echo('include', 'include'), F, E, B)).toEqual(base);
  });

  it('keeps the BOT HITS count and reads excluded, neutral, when the echo excludes bots', () => {
    const on = byLabel(deriveKpis(echo('include', 'exclude'), null, null, null), 'BOT');
    expect(on.value).toBe('100');
    expect(on.sub).toBe('excluded');
    expect(on.tone).toBe('neutral');
    const off = byLabel(deriveKpis(echo('include', 'include'), null, null, null), 'BOT');
    expect(off.value).toBe('100');
    expect(off.sub).toBe('10% of hits');
    expect(off.tone).toBe('amber');
  });

  it('marks UNIQUE VISITORS excl. mine only when the echo excludes mine', () => {
    const on = byLabel(deriveKpis(echo('exclude', 'include'), null, null, null), 'UNIQUE');
    expect(on.value).toBe('120');
    expect(on.sub).toBe('2 countries · excl. mine');
    expect(byLabel(deriveKpis(echo('include', 'exclude'), null, null, null), 'UNIQUE').sub).toBe('2 countries');
    expect(byLabel(deriveKpis(echo('include', 'include'), null, null, null), 'UNIQUE').sub).toBe('2 countries');
  });

  it('with both excluded in the echo relabels only BOT HITS and UNIQUE VISITORS', () => {
    const base = deriveKpis(traffic(), F, E, B);
    const k = deriveKpis(echo('exclude', 'exclude', 42), F, E, B);
    expect(byLabel(k, 'UNIQUE').sub).toBe('2 countries · excl. mine');
    expect(byLabel(k, 'BOT')).toEqual({ label: 'BOT HITS', value: '100', sub: 'excluded', tone: 'neutral' });
    for (const label of ['HITS', '404S', 'CLICKS', 'APP SESSIONS', 'ERRORS', 'EGRESS', 'BLOG CADENCE']) {
      expect(k.find((x) => x.label === label)).toEqual(base.find((x) => x.label === label));
    }
  });

  it('ignores local toggles that say exclude when the echo says include', () => {
    const k = withLocal(echo('include', 'include'), F, E, B, { mine: true, bots: true });
    expect(byLabel(k, 'BOT').sub).toBe('10% of hits');
    expect(byLabel(k, 'BOT').tone).toBe('amber');
    expect(byLabel(k, 'UNIQUE').sub).toBe('2 countries');
  });

  it('gives no filter labels when the traffic response has no filters echo', () => {
    const k = withLocal(traffic(), F, E, B, { mine: true, bots: true });
    expect(byLabel(k, 'BOT').sub).toBe('10% of hits');
    expect(byLabel(k, 'UNIQUE').sub).toBe('2 countries');
  });

  it('keeps em-dash values and empty subs without traffic', () => {
    const k = withLocal(null, null, null, null, { mine: true, bots: true });
    expect(byLabel(k, 'BOT')).toMatchObject({ value: '—', sub: '' });
    expect(byLabel(k, 'UNIQUE')).toMatchObject({ value: '—', sub: '' });
  });
});

describe('deriveStatus', () => {
  const obs = (open: number[], globals?: number): ObservabilityData => ({
    env: 'prod', desktopApps: [], latestKit: null, generatedAt: 0,
    rows: open.map((n, i) => ({
      slug: `r${i}`, openAlerts: Array.from({ length: n }, () => ({ kind: 'k', details: 'd' })),
    })) as unknown as ObservabilityData['rows'],
    ...(globals ? { globalAlerts: Array.from({ length: globals }, () => ({ kind: 'g', details: 'd' })) } : {}),
  });

  it('is ONLINE with no alerts', () => {
    expect(deriveStatus(obs([0, 0]), false)).toEqual({ label: 'ONLINE', tone: 'green' });
  });
  it('counts row alerts plus globalAlerts', () => {
    expect(deriveStatus(obs([1, 2], 2), false)).toEqual({ label: '5 ALERTS', tone: 'amber' });
  });
  it('is STALE when the refresh failed', () => {
    expect(deriveStatus(obs([3]), true)).toEqual({ label: 'STALE', tone: 'red' });
  });
});

describe('deriveKpis UNIQUE VISITORS confirmed count', () => {
  const ex = (mine: 'include' | 'exclude') => ({ filters: { mine, bots: 'include' as const, mineHits: 0 } });

  it('shows confirmed of fetched when the server sends confirmedVisitors', () => {
    const k = byLabel(deriveKpis(traffic({ visitors: 54, confirmedVisitors: 0 }), null, null, null), 'UNIQUE');
    expect(k.value).toBe('0');
    expect(k.sub).toBe('of 54 fetched');
  });

  it('appends the excl. mine note to the confirmed sub', () => {
    const k = byLabel(deriveKpis(traffic({ visitors: 1200, confirmedVisitors: 7 }, ex('exclude')), null, null, null), 'UNIQUE');
    expect(k.value).toBe('7');
    expect(k.sub).toBe('of 1,200 fetched · excl. mine');
  });

  it('keeps the countries tile when confirmedVisitors is absent (older server)', () => {
    const plain = byLabel(deriveKpis(traffic({ visitors: 54 }), null, null, null), 'UNIQUE');
    expect(plain.value).toBe('54');
    expect(plain.sub).toBe('2 countries');
    const mine = byLabel(deriveKpis(traffic({ visitors: 54 }, ex('exclude')), null, null, null), 'UNIQUE');
    expect(mine.value).toBe('54');
    expect(mine.sub).toBe('2 countries · excl. mine');
  });
});

import { describe, it, expect } from 'vitest';
import { deriveKpis, deriveStatus } from '../src/pages/admin/command/useCommandData.js';
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

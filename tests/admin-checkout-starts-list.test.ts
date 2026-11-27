import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import { initDb, dbRun } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return { ...original, requireAdmin: vi.fn().mockResolvedValue('admin@t.dev') };
});

import { requireAdmin } from '../server/clerk.js';
import { registerAdminWebProductRoutes, CHECKOUT_LABELS_SINCE } from '../server/routes/admin-web-products.js';
import type { WebProduct } from '../shared/web-products.js';

const product: WebProduct = {
  slug: 'list-skills',
  name: 'List Skills',
  productKey: 'wp_list_skills',
  priceEnvVar: 'STRIPE_PRICE_WP_LIST_SKILLS',
  displayPrice: '$9',
  downloadLimit: 3,
  release: null,
} as any;

const app = Fastify({ logger: false });
registerAdminWebProductRoutes(app, { products: [product] });

const DAY = 86400000;
const NOW = Date.parse('2026-11-25T12:00:00Z');
const dayStr = (ago: number) => new Date(Date.now() - ago * DAY).toISOString().slice(0, 10);
const ts = (ago: number, time = '12:00:00') => `${dayStr(ago)} ${time}`;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await initDb();
  await app.ready();
});

afterAll(() => {
  vi.useRealTimers();
});

type Seed = {
  tool?: string; created?: string; visitor?: string | null; session?: string | null; bot?: number; admin?: number;
  internal?: number; path?: string | null; metadata?: string | null; event?: string; ipHash?: string;
};
const fe = (o: Seed) =>
  dbRun(`INSERT INTO funnel_events (event, tool, created_at, visitor_id, session_id, is_bot, is_admin, is_internal, path, metadata, email, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    o.event ?? 'checkout_start', o.tool ?? 'list-skills', o.created ?? ts(0), o.visitor ?? null, o.session ?? null,
    o.bot ?? 0, o.admin ?? 0, o.internal ?? 0, o.path ?? null, o.metadata ?? null, 'buyer@t.dev', o.ipHash ?? 'iphash-secret');

beforeEach(async () => {
  vi.mocked(requireAdmin).mockResolvedValue('admin@t.dev');
  for (const t of ['page_views', 'page_hits', 'funnel_events', 'web_product_orders', 'web_product_downloads', 'web_product_releases', 'internal_devices', 'sessions']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  const pv = (visitor: string, session: string, bot: number, admin = 0) =>
    dbRun('INSERT INTO page_views (path, date, visitor_id, session_id, is_bot, is_admin) VALUES (?, ?, ?, ?, ?, ?)',
      '/projects/x/', dayStr(0), visitor, session, bot, admin);
  await pv('bot-v', 's-bv', 1);
  await pv('other-v', 'bot-s', 1);
  await pv('human-v', 'human-s', 0);
  await pv('adm-v', 'adm-s', 0, 1);

  await dbRun(`INSERT INTO sessions (session_id, visitor_id, started_at, ended_at, landing_path, referrer_host, source_bucket,
                 utm_source, utm_medium, utm_campaign, country, device)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'human-s', 'human-v', NOW - 3600000, NOW - 1800000, '/projects/list-skills/', 'news.example', 'social', 'hn', 'post', 'launch', 'US', 'desktop');
  await dbRun(`INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_class, session_id) VALUES (?, ?, ?, 200, ?, ?, ?)`,
    NOW - 3600000, dayStr(0), '/projects/list-skills/', 0, 'human', 'human-s');
  await dbRun(`INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_class, session_id) VALUES (?, ?, ?, 200, ?, ?, ?)`,
    NOW - 3500000, dayStr(0), '/projects/list-skills/x', 1, null, 'human-s');
  await dbRun('INSERT INTO internal_devices (visitor_id, label, marked_at_ms) VALUES (?, ?, ?)', 'dev-v', 'laptop', NOW - DAY);

  // session-with-utm (human), web-product with a live checkout session.
  await fe({ visitor: 'human-v', session: 'human-s', path: '/projects/list-skills/', created: ts(0, '11:00:00'),
    metadata: JSON.stringify({ path: '/projects/list-skills/', checkout_session_id: 'cs_live_abc' }) });
  // owner (owner IP).
  await fe({ visitor: 'adm-v', session: 'adm-s', admin: 1, created: ts(1),
    metadata: JSON.stringify({ path: '/projects/list-skills/', checkout_session_id: 'cs_test_xyz' }) });
  // UA bot.
  await fe({ visitor: 'ua-v', bot: 1, created: ts(2) });
  // bot visitor.
  await fe({ visitor: 'bot-v', created: ts(2, '13:00:00') });
  // bot session (no sessions row).
  await fe({ visitor: 'nv', session: 'bot-s', created: ts(3) });
  // agent-buy: no ids.
  await fe({ tool: 'agent-offer', created: ts(4), metadata: JSON.stringify({ via: 'agent-buy', offer: 'agent-offer', checkout_session_id: 'cs_live_agent' }) });
  // client event, internal marker, not-JSON metadata.
  await fe({ tool: 'some-app', visitor: 'cv', session: 'cs-1', internal: 1, created: ts(3, '08:00:00'), metadata: 'raw-text' });
  // owner device (internal_devices).
  await fe({ visitor: 'dev-v', session: 'dev-s', created: ts(3, '09:00:00') });
  // pre-cutoff, inside a 30-day window.
  await fe({ visitor: 'old-v', created: '2026-11-10 10:00:00' });
  // out of window for both 7 and 30.
  await fe({ bot: 1, created: ts(40) });
  // non-checkout event.
  await fe({ event: 'page_view', bot: 1 });
});

const list = async (q = '') => {
  const res = await app.inject({ method: 'GET', url: `/api/admin/checkout-starts${q}` });
  expect(res.statusCode).toBe(200);
  return res;
};
const split = async (days: number, excludeSelf = true) =>
  (await app.inject({ method: 'GET', url: `/api/admin/web-products?days=${days}${excludeSelf ? '' : '&exclude_self=0'}` })).json().checkoutStartsAll;

describe('GET /api/admin/checkout-starts', () => {
  it('seed places the pre-cutoff row before CHECKOUT_LABELS_SINCE', () => {
    expect('2026-11-10 10:00:00' < CHECKOUT_LABELS_SINCE).toBe(true);
  });

  for (const days of [7, 30]) {
    it(`agrees with checkoutStartsAll for days=${days}`, async () => {
      const res = await list(`?days=${days}&limit=1000`);
      expect(res.headers['cache-control']).toBe('no-store');
      const body = res.json();
      const grouped = { human: 0, automated: 0, unlabeled: 0 } as Record<string, number>;
      for (const r of body.starts) if (r.counted) grouped[r.label] += 1;
      const counted = await split(days);
      expect(grouped).toEqual(counted);
      expect(body.totals.counted).toEqual(counted);
      expect(body.totals.all).toEqual(await split(days, false));
      expect(body.totals.starts).toBe(body.starts.length);
      expect(body.totals.ownerFlagged).toBe(1);
      expect(body.listed).toBe(body.starts.length);
      expect(body.truncated).toBe(false);
      expect(body.days).toBe(days);
      expect(body.since).toBe(dayStr(days));
      expect(body.labelsSince).toBe(CHECKOUT_LABELS_SINCE);
      expect(body.starts.length).toBe(days === 7 ? 8 : 9);
      if (days === 30) expect(body.starts.find((r: any) => r.visitorId === 'old-v').label).toBe('unlabeled');
    });
  }

  it('returns exactly the row fields and never email or ip_hash', async () => {
    const body = (await list()).json();
    for (const r of body.starts) {
      expect(Object.keys(r).sort()).toEqual([
        'checkoutSessionId', 'counted', 'createdAt', 'hit', 'id', 'label', 'labelReasons', 'metadata', 'mine', 'mineReasons', 'path',
        'session', 'sessionId', 'sessionNote', 'source', 'stripeMode', 'tool', 'ts', 'visitorClasses', 'visitorId',
      ]);
    }
    expect(JSON.stringify(body)).not.toContain('buyer@t.dev');
    expect(JSON.stringify(body)).not.toContain('iphash-secret');
  });

  it('marks owner, automated, source and session details', async () => {
    const rows = (await list('?days=30')).json().starts as any[];
    const by = (v: string | null, tool?: string) => rows.find((r) => (tool ? r.tool === tool : r.visitorId === v));

    const owner = by('adm-v');
    expect(owner.counted).toBe(false);
    expect(owner.mineReasons).toEqual(['owner_ip', 'admin_session']);
    expect(owner.mine).toBe(true);
    expect(owner.stripeMode).toBe('test');
    expect(owner.source).toBe('web-product');
    expect(owner.path).toBe('/projects/list-skills/');

    expect(by('ua-v')).toMatchObject({ label: 'automated', labelReasons: ['ua'], counted: true, mine: false });
    expect(by('bot-v')).toMatchObject({ label: 'automated', labelReasons: ['visitor_bot_view'] });
    expect(by('nv')).toMatchObject({
      label: 'automated', labelReasons: ['session_bot_view'], session: null, sessionNote: 'no sessions row for this session id',
    });

    const agent = by(null, 'agent-offer');
    expect(agent).toMatchObject({
      source: 'agent-buy', checkoutSessionId: 'cs_live_agent', stripeMode: 'live', visitorId: null, sessionId: null,
      session: null, sessionNote: 'no session id recorded on this start', visitorClasses: [], label: 'human', hit: null,
    });

    const client = by(null, 'some-app');
    expect(client).toMatchObject({ source: 'client-event', metadata: 'raw-text', mineReasons: ['internal_marker'], counted: true, checkoutSessionId: null });

    expect(by('dev-v')).toMatchObject({ mineReasons: ['owner_device'], mine: true, counted: true, label: 'human' });

    const human = by('human-v');
    expect(human).toMatchObject({
      label: 'human', labelReasons: [], counted: true, mine: false, mineReasons: [], source: 'web-product',
      checkoutSessionId: 'cs_live_abc', stripeMode: 'live', sessionNote: null, visitorClasses: ['human', 'script'],
      ts: Date.parse(`${dayStr(0)}T11:00:00Z`),
      session: {
        startedAt: NOW - 3600000, landingPath: '/projects/list-skills/', referrerHost: 'news.example', sourceBucket: 'social',
        utmSource: 'hn', utmMedium: 'post', utmCampaign: 'launch', country: 'US', device: 'desktop',
      },
    });
    expect(human.hit).toBeNull();
    expect(human.metadata).toEqual({ path: '/projects/list-skills/', checkout_session_id: 'cs_live_abc' });
    // Newest first.
    expect(rows[0].visitorId).toBe('human-v');
  });

  it('truncates to limit and clamps params', async () => {
    const body = (await list('?days=30&limit=2')).json();
    expect(body.listed).toBe(2);
    expect(body.starts.length).toBe(2);
    expect(body.truncated).toBe(true);
    expect(body.totals.starts).toBe(9);
    const clamped = (await list('?days=9999&limit=0')).json();
    expect(clamped.days).toBe(365);
    expect(clamped.listed).toBe(1);
    expect((await list('?days=abc')).json().days).toBe(7);
  });

  it('returns nothing when requireAdmin refuses', async () => {
    vi.mocked(requireAdmin).mockImplementationOnce(async (_req: unknown, reply: any) => {
      reply.status(403).send({ error: 'Forbidden' });
      return null;
    });
    const res = await app.inject({ method: 'GET', url: '/api/admin/checkout-starts' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Forbidden' });
  });
});

const BUYER_IP = '203.0.113.7';
const OTHER_IP = '198.51.100.9';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const hit = (o: { ts: number; ip: string; path?: string; cls?: string | null; bot?: number; ref?: string; country?: string }) =>
  dbRun(`INSERT INTO page_hits (ts_ms, date, path, status, referrer_host, country, device, browser, os, is_bot, visitor_class, ip, ua, referrer, user_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    o.ts, dayStr(1), o.path ?? '/buy/git-viewer', 303, o.ref ?? 'news.example', o.country ?? 'DE', 'mobile', 'Safari', 'iOS',
    o.bot ?? 0, o.cls ?? null, o.ip, 'Mozilla/5.0 SecretUA/1.0', 'https://news.example/secret-ref', 'hitter@t.dev');

describe('GET /api/admin/checkout-starts agent-buy hit', () => {
  // Fixed from NOW, not dayStr: describe bodies run before the fake clock is set.
  const T = Date.parse('2026-11-24T10:00:00Z');
  const seed = async () => {
    await fe({ tool: 'git-viewer', created: `${dayStr(1)} 10:00:00`, ipHash: sha(BUYER_IP),
      metadata: JSON.stringify({ via: 'agent-buy', offer: 'git-viewer', checkout_session_id: 'cs_live_gv' }) });
    // The buyer's own /buy request, 800 ms into the start's second.
    await hit({ ts: T + 800, ip: BUYER_IP });
    // Same path, nearer in time, different IP: never matches.
    await hit({ ts: T + 500, ip: OTHER_IP, cls: 'automated', country: 'US', ref: 'other.example' });
    // Same IP, older but inside the window: farther than the real one.
    await hit({ ts: T - 20000, ip: BUYER_IP, cls: 'automated', country: 'FR' });
    // Same IP, outside the window.
    await hit({ ts: T - 60000, ip: BUYER_IP, cls: 'automated', country: 'GB' });
    // Same IP, other path, 1500 ms away (not a burst).
    await hit({ ts: T + 1500, ip: BUYER_IP, path: '/buy/other', cls: 'automated', country: 'JP' });
  };

  it('matches the /buy hit by IP hash and nearest time', async () => {
    await seed();
    const body = (await list('?days=30&limit=1000')).json();
    const row = body.starts.find((r: any) => r.tool === 'git-viewer');
    expect(row.source).toBe('agent-buy');
    expect(row.hit).toEqual({
      ts: T + 800, path: '/buy/git-viewer', status: 303, referrerHost: 'news.example', country: 'DE', device: 'mobile',
      browser: 'Safari', os: 'iOS', visitorClass: 'human',
    });
    expect(row.visitorClasses).toEqual(['human']);
    expect(row).toMatchObject({ label: 'human', labelReasons: [], counted: true, mine: false, sessionNote: 'no session id recorded on this start' });
  });

  it('uses visitor_class, else script for is_bot rows', async () => {
    await fe({ tool: 'git-viewer', created: `${dayStr(1)} 10:00:00`, ipHash: sha(BUYER_IP),
      metadata: JSON.stringify({ via: 'agent-buy', offer: 'git-viewer' }) });
    await hit({ ts: T + 100, ip: BUYER_IP, bot: 1 });
    let row = (await list('?days=30')).json().starts.find((r: any) => r.tool === 'git-viewer');
    expect(row.hit.visitorClass).toBe('script');
    expect(row.visitorClasses).toEqual(['script']);
    await dbRun('UPDATE page_hits SET visitor_class = ? WHERE ip = ?', 'automated', BUYER_IP);
    row = (await list('?days=30')).json().starts.find((r: any) => r.tool === 'git-viewer');
    expect(row.hit.visitorClass).toBe('automated');
  });

  it('leaves hit null for unmatched agent-buy and other sources', async () => {
    await seed();
    const rows = (await list('?days=30&limit=1000')).json().starts as any[];
    const unmatched = rows.find((r) => r.tool === 'agent-offer');
    expect(unmatched.source).toBe('agent-buy');
    expect(unmatched.hit).toBeNull();
    expect(unmatched.visitorClasses).toEqual([]);
    const web = rows.find((r) => r.visitorId === 'human-v');
    expect(web.source).toBe('web-product');
    expect(web.hit).toBeNull();
    for (const r of rows) if (r.source !== 'agent-buy') expect(r.hit).toBeNull();
  });

  it('never returns the IP, user agent, referrer, email or ip_hash', async () => {
    await seed();
    const text = JSON.stringify((await list('?days=30&limit=1000')).json());
    for (const s of [BUYER_IP, OTHER_IP, sha(BUYER_IP), 'SecretUA', 'secret-ref', 'hitter@t.dev', 'iphash-secret', 'buyer@t.dev']) {
      expect(text).not.toContain(s);
    }
  });

  for (const days of [7, 30]) {
    it(`still agrees with checkoutStartsAll for days=${days} with hits seeded`, async () => {
      await seed();
      const body = (await list(`?days=${days}&limit=1000`)).json();
      const grouped = { human: 0, automated: 0, unlabeled: 0 } as Record<string, number>;
      for (const r of body.starts) if (r.counted) grouped[r.label] += 1;
      const counted = await split(days);
      expect(grouped).toEqual(counted);
      expect(body.totals.counted).toEqual(counted);
      expect(body.totals.all).toEqual(await split(days, false));
    });
  }
});

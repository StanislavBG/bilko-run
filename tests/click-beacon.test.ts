import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerSecurityHeaders } from '../server/security-headers.js';
import { registerClickBeacon, BEACON_JS } from '../server/click-beacon.js';

const HTML = '<html><head><title>x</title></head><body><script src="/a.js"></script></body></html>';
const dir = mkdtempSync(join(tmpdir(), 'beacon-'));
writeFileSync(join(dir, 'index.html'), HTML);

const app = Fastify();

function nonceOf(headers: Record<string, any>): string {
  const csp = (headers['content-security-policy-report-only'] ?? headers['content-security-policy'] ?? '') as string;
  return csp.match(/nonce-([A-Za-z0-9+/=]+)/)![1];
}

beforeAll(async () => {
  registerSecurityHeaders(app);
  registerClickBeacon(app);
  app.get('/page', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/nohead', async (_req, reply) => reply.type('text/html').send('<p>hi</p>'));
  app.get('/json', async () => ({ ok: true }));
  app.get('/dl', async (_req, reply) =>
    reply.type('text/html').header('content-disposition', 'attachment; filename="m.html"').send(HTML));
  app.get('/blog-videos/x/', async (_req, reply) => reply.type('text/html').send(HTML));
  await app.register(fastifyStatic, { root: dir, prefix: '/static/' });
  await app.ready();
});

describe('click beacon', () => {
  it('is small and has no external URLs', () => {
    expect(Buffer.byteLength(BEACON_JS)).toBeLessThan(4000);
    expect(BEACON_JS).not.toMatch(/https?:\/\//);
  });

  it('injects exactly one nonced script before </head>', async () => {
    const res = await app.inject({ method: 'GET', url: '/page' });
    const nonce = nonceOf(res.headers);
    const tag = `<script nonce="${nonce}">${BEACON_JS}</script></head>`;
    expect(res.body).toContain(tag);
    expect(res.body.split('/api/analytics/click').length - 1).toBe(1);
    expect(res.body.split(`nonce="${nonce}"><`).length).toBeGreaterThan(0);
    expect(res.body.match(new RegExp(`nonce="${nonce}"\\s+nonce=`))).toBeNull();
  });

  it('leaves HTML with no head/body unchanged', async () => {
    const res = await app.inject({ method: 'GET', url: '/nohead' });
    expect(res.body).toBe('<p>hi</p>');
  });

  it('leaves JSON, attachments and /blog-videos/ alone', async () => {
    expect((await app.inject({ method: 'GET', url: '/json' })).body).toBe('{"ok":true}');
    expect((await app.inject({ method: 'GET', url: '/dl' })).body).toBe(HTML);
    expect((await app.inject({ method: 'GET', url: '/blog-videos/x/' })).body).not.toContain('/api/analytics/click');
  });

  it('injects into streamed static HTML with no stale content-length', async () => {
    const res = await app.inject({ method: 'GET', url: '/static/index.html' });
    expect(res.body).toContain('/api/analytics/click');
    // Fastify recomputes content-length from the final string; it must match the
    // injected body, not the on-disk file size.
    expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength(res.body));
    expect(Number(res.headers['content-length'])).toBeGreaterThan(Buffer.byteLength(HTML));
  });
});

const VID = '11111111-1111-4111-8111-111111111111';
const SID = '22222222-2222-4222-8222-222222222222';
const LVID = '33333333-3333-4333-8333-333333333333';

function el(attrs: Record<string, string>, text: string, opts: { tag?: string; redact?: boolean; trackEl?: any } = {}) {
  const e: any = {
    tagName: (opts.tag ?? 'a').toUpperCase(), id: '', textContent: text,
    getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
    closest: (sel: string) => {
      if (sel === '[data-track-redact]') return opts.redact ? e : null;
      if (sel === '[data-track]') return 'data-track' in attrs ? e : null;
      return e;
    },
  };
  return e;
}

function run(opts: { path?: string; cookie?: string; ls?: Record<string, string>; search?: string; referrer?: string } = {}) {
  const jar = new Map<string, string>();
  for (const part of (opts.cookie ?? '').split(';')) {
    const [k, v] = part.split('=');
    if (k && v) jar.set(k.trim(), v.trim());
  }
  const store = new Map<string, string>(Object.entries(opts.ls ?? {}));
  const beacons: { url: string; body: any }[] = [];
  const listeners: Record<string, Function[]> = {};
  const loc: any = { pathname: opts.path ?? '/', search: opts.search ?? '', protocol: 'https:' };
  const origPush = function (this: any, _s: any, _t: any, url: string) { loc.pathname = url.split('?')[0]; return 'pushed'; };
  const history: any = { pushState: origPush, replaceState: origPush };
  const document: any = {
    referrer: opts.referrer ?? '',
    get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); },
    set cookie(c: string) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); },
    addEventListener: (t: string, f: Function) => { (listeners[t] ??= []).push(f); },
  };
  const ctx: any = {
    document, location: loc, history, localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    navigator: { sendBeacon: (url: string, body: string) => { beacons.push({ url, body: JSON.parse(body) }); return true; } },
    addEventListener: (t: string, f: Function) => { (listeners[t] ??= []).push(f); },
    screen: { width: 1280, height: 720 },
  };
  ctx.window = ctx;
  vm.runInNewContext(BEACON_JS, ctx);
  const click = (target: any) => listeners.click.forEach((f) => f({ target }));
  return { beacons, jar, store, history, loc, click, listeners, origPush };
}

describe('beacon runtime', () => {
  it('reuses ids from the cookie and sends an initial pageview', () => {
    const r = run({ path: '/projects/x/', cookie: `bilko_vid=${VID}; bilko_sid=${SID}`, search: '?utm_source=tw&utm_campaign=a%20b&foo=1', referrer: 'https://ref.example/' });
    expect(r.beacons).toHaveLength(1);
    expect(r.beacons[0].url).toBe('/api/analytics/pageview');
    expect(r.beacons[0].body).toMatchObject({ path: '/projects/x/', referrer: 'https://ref.example/', screen: '1280x720', visitor_id: VID, session_id: SID, utm_source: 'tw', utm_campaign: 'a b' });
    expect(r.beacons[0].body.foo).toBeUndefined();
    expect(r.jar.get('bilko_sid')).toBe(SID);
  });

  it('lets a valid legacy localStorage vid win over the cookie', () => {
    const r = run({ cookie: `bilko_vid=${VID}`, ls: { bilko_vid: LVID } });
    expect(r.beacons[0].body.visitor_id).toBe(LVID);
    expect(r.jar.get('bilko_vid')).toBe(LVID);
    expect(r.beacons[0].body.session_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends click payload with track, scrubbed label and href', () => {
    const r = run({ cookie: `bilko_vid=${VID}; bilko_sid=${SID}` });
    r.click(el({ href: '/go?token=abc#frag', 'data-track': 'x'.repeat(80) }, ' mail me@ex.com ref 1234567 '));
    const c = r.beacons.find((b) => b.url === '/api/analytics/click')!.body;
    expect(c).toMatchObject({ label: 'mail [email] ref #', href: '/go', visitor_id: VID, session_id: SID, track: 'x'.repeat(60) });
    r.click(el({ href: '/a' }, 'secret', { redact: true }));
    expect(r.beacons[r.beacons.length - 1].body).toMatchObject({ label: '', track: '' });
  });

  it('sends a pageview per pushState to a new path, none for same path', () => {
    const r = run({ path: '/a' });
    const res = r.history.pushState({}, '', '/b');
    expect(res).toBe('pushed');
    r.history.replaceState({}, '', '/b');
    r.history.pushState({}, '', '/c');
    const pvs = r.beacons.filter((b) => b.url === '/api/analytics/pageview');
    expect(pvs.map((b) => b.body.path)).toEqual(['/a', '/b', '/c']);
    expect(pvs[1].body.referrer).toBe('');
  });

  it('does nothing on /admin but tracks after navigating away', () => {
    const r = run({ path: '/admin/users' });
    r.click(el({ href: '/x' }, 'hi'));
    expect(r.beacons).toHaveLength(0);
    r.history.pushState({}, '', '/home');
    expect(r.beacons.map((b) => b.body.path)).toEqual(['/home']);
  });

  it('wrappers never throw when the beacon throws', () => {
    const r = run({ path: '/a' });
    r.history.pushState({}, '', '/b');
    expect(r.beacons.length).toBeGreaterThan(0);
  });
});

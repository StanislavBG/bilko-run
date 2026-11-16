import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerSecurityHeaders, cspIsEnforced } from '../server/security-headers.js';
import { initDb, dbGet, dbRun } from '../server/db.js';

const TEST_HTML = '<html><head></head><body><script src="/app.js"></script><style>.x{}</style></body></html>';

const PRELOAD_HTML =
  '<html><head>' +
  '<link rel="preload" href="/_expo/static/js/web/entry.js" as="script"/>' +
  '<link rel="modulepreload" crossorigin href="/assets/clerk.js">' +
  '<LINK REL=PRELOAD AS=SCRIPT HREF=/c.js>' +
  "<link as='script' rel='preload' href='/d.js?x=1>2'>" +
  '<link rel="preload" href="/s.css" as="style"/>' +
  '<link rel="stylesheet" href="/s.css"/>' +
  '<link rel="icon" href="/favicon.ico"/>' +
  '<link rel="preload" as="script" nonce="theirs" href="/e.js">' +
  '</head><body>' +
  `<script>var s = '<link rel="preload" as="script" href="/f.js">';</script>` +
  '</body></html>';

function getCsp(headers: Record<string, string | string[] | undefined>): string {
  return (headers['content-security-policy-report-only'] ?? headers['content-security-policy'] ?? '') as string;
}

function extractNonce(csp: string): string | undefined {
  return csp.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];
}

const app = Fastify();

beforeAll(async () => {
  await initDb();
  await dbRun('DELETE FROM csp_violations');
  registerSecurityHeaders(app);
  app.get('/test-html', async (_req, reply) => reply.type('text/html').send(TEST_HTML));
  app.get('/api/test', async () => ({ ok: true }));
  app.get('/projects/escape-velocity/', async (_req, reply) => reply.type('text/html').send(TEST_HTML));
  app.get('/projects/preload-matrix/', async (_req, reply) => reply.type('text/html').send(PRELOAD_HTML));
  app.get('/blog-videos/x/', async (_req, reply) => reply.type('text/html').send('<html><head></head><body><script>1</script></body></html>'));
  await app.ready();
});

describe('Security headers — HTML response', () => {
  it('sends all required security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-html' });
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains; preload');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(getCsp(res.headers)).toContain('default-src');
  });

  it('CSP contains nonce', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-html' });
    const nonce = extractNonce(getCsp(res.headers));
    expect(nonce).toBeTruthy();
    expect(nonce!.length).toBeGreaterThan(8);
  });

  it('script-src allows wasm compilation but not JS eval or inline', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-html' });
    const csp = getCsp(res.headers);
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBeTruthy();
    const tokens = scriptSrc!.split(/\s+/);
    expect(tokens).toContain(`'wasm-unsafe-eval'`);
    expect(tokens).not.toContain(`'unsafe-eval'`);
    expect(tokens).not.toContain(`'unsafe-inline'`);
  });

  it('each request gets a different nonce', async () => {
    const r1 = await app.inject({ method: 'GET', url: '/test-html' });
    const r2 = await app.inject({ method: 'GET', url: '/test-html' });
    expect(extractNonce(getCsp(r1.headers))).not.toBe(extractNonce(getCsp(r2.headers)));
  });

  it('injects nonce onto <script> tags in HTML body', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-html' });
    const nonce = extractNonce(getCsp(res.headers));
    expect(res.payload).toContain(`<script nonce="${nonce}"`);
  });

  it('injects nonce onto <style> tags in HTML body', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-html' });
    const nonce = extractNonce(getCsp(res.headers));
    expect(res.payload).toContain(`<style nonce="${nonce}"`);
  });

  it('does not double-inject nonce on already-nonce-bearing tags', async () => {
    const alreadyNonced = '<html><head></head><body><script nonce="existing">1</script></body></html>';
    const a = Fastify();
    registerSecurityHeaders(a);
    a.get('/', async (_req, reply) => reply.type('text/html').send(alreadyNonced));
    await a.ready();
    const res = await a.inject({ method: 'GET', url: '/' });
    const matches = res.payload.match(/nonce=/g) ?? [];
    expect(matches.length).toBe(1); // no double-nonce
    await a.close();
  });

  it('injects csp-nonce <meta> tag into <head>', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-html' });
    const nonce = extractNonce(getCsp(res.headers));
    expect(res.payload).toContain(`<meta name="csp-nonce" content="${nonce}">`);
  });

  // Under 'strict-dynamic' a parser-started script fetch needs the nonce even
  // when same-origin: each unnonced Expo preload filed a report per page view.
  it('stamps the nonce onto script preload links, and only those', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/preload-matrix/' });
    const nonce = extractNonce(getCsp(res.headers));
    expect(nonce).toBeTruthy();
    const n = `nonce="${nonce}"`;
    expect(res.payload).toContain(`<link ${n} rel="preload" href="/_expo/static/js/web/entry.js" as="script"/>`);
    expect(res.payload).toContain(`<link ${n} rel="modulepreload" crossorigin href="/assets/clerk.js">`);
    expect(res.payload).toContain(`<LINK ${n} REL=PRELOAD AS=SCRIPT HREF=/c.js>`);
    expect(res.payload).toContain(`<link ${n} as='script' rel='preload' href='/d.js?x=1>2'>`);
    // Not script fetches: 'self' already covers them, so they stay as written.
    expect(res.payload).toContain('<link rel="preload" href="/s.css" as="style"/>');
    expect(res.payload).toContain('<link rel="stylesheet" href="/s.css"/>');
    expect(res.payload).toContain('<link rel="icon" href="/favicon.ico"/>');
    // An existing nonce is left alone.
    expect(res.payload).toContain('<link rel="preload" as="script" nonce="theirs" href="/e.js">');
    // Link text inside JavaScript is not markup.
    expect(res.payload).toContain(`var s = '<link rel="preload" as="script" href="/f.js">';`);
  });

  it('stamps the nonce onto script preloads in a static-path index.html served from disk', async () => {
    const root = mkdtempSync(join(tmpdir(), 'csp-preload-'));
    mkdirSync(join(root, 'projects', 'expo-app'), { recursive: true });
    writeFileSync(
      join(root, 'projects', 'expo-app', 'index.html'),
      '<!DOCTYPE html><html><head>' +
        '<link rel="preload" href="/projects/expo-app/_expo/static/js/web/entry-1.js" as="script"/>' +
        '</head><body><script defer="" src="/projects/expo-app/_expo/static/js/web/entry-1.js"></script></body></html>',
    );
    const a = Fastify();
    registerSecurityHeaders(a);
    await a.register(staticPlugin, { root, prefix: '/', redirect: true, cacheControl: false });
    await a.ready();
    try {
      const res = await a.inject({ method: 'GET', url: '/projects/expo-app/' });
      expect(res.statusCode).toBe(200);
      const nonce = extractNonce(res.headers['content-security-policy-report-only'] as string);
      expect(nonce).toBeTruthy();
      expect(res.payload).toContain(
        `<link nonce="${nonce}" rel="preload" href="/projects/expo-app/_expo/static/js/web/entry-1.js" as="script"/>`,
      );
      expect(res.payload).toContain(`<script nonce="${nonce}" defer=""`);
    } finally {
      await a.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('Security headers — API response', () => {
  it('sends security headers on non-HTML responses too', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(getCsp(res.headers)).toContain('default-src');
  });
});

describe('CSP violation report endpoint', () => {
  const report = {
    'csp-report': {
      'blocked-uri': 'https://evil.com/bad.js',
      'violated-directive': 'script-src',
      'document-uri': 'https://bilko.run/',
      'source-file': 'https://bilko.run/app.js',
      'line-number': 7,
    },
  };

  it('accepts a violation report and persists it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/csp-report',
      headers: { 'content-type': 'application/csp-report' },
      payload: JSON.stringify(report),
      remoteAddress: '1.2.3.4',
    });
    expect(res.statusCode).toBe(204);
    const row = await dbGet<{ blocked_uri: string; violated_dir: string; line_number: number }>(
      'SELECT * FROM csp_violations ORDER BY id DESC LIMIT 1',
    );
    expect(row?.blocked_uri).toBe('https://evil.com/bad.js');
    expect(row?.violated_dir).toBe('script-src');
    expect(row?.line_number).toBe(7);
  });

  it('also accepts flat JSON body (no csp-report wrapper)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/csp-report',
      headers: { 'content-type': 'application/csp-report' },
      payload: JSON.stringify({ 'blocked-uri': 'https://other.com', 'violated-directive': 'img-src' }),
      remoteAddress: '1.2.3.5',
    });
    expect(res.statusCode).toBe(204);
  });

  const post = (ip: string, blockedUri: string) =>
    app.inject({
      method: 'POST',
      url: '/api/security/csp-report',
      headers: { 'content-type': 'application/csp-report' },
      payload: JSON.stringify({ 'csp-report': { 'blocked-uri': blockedUri, 'violated-directive': 'script-src-elem' } }),
      remoteAddress: ip,
    });

  const rowsFor = async (blockedUri: string) =>
    (await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM csp_violations WHERE blocked_uri = ?', blockedUri))?.n;

  // A 4xx on a report logs "Failed to load resource" in the visitor's console,
  // and no browser acts on the status, so a dropped report still gets a 204.
  it('answers 204 past the per-IP budget and persists only the first 10 new reports', async () => {
    const ip = '10.0.0.99';
    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) statuses.push((await post(ip, `https://budget.test/${i}`)).statusCode);
    expect(statuses).toEqual(Array(15).fill(204));
    const row = await dbGet<{ n: number }>(
      "SELECT COUNT(*) AS n FROM csp_violations WHERE blocked_uri LIKE 'https://budget.test/%'",
    );
    expect(row?.n).toBe(10);
  });

  it('repeats of a report already on file spend none of the IP budget', async () => {
    const ip = '10.0.0.100';
    for (let i = 0; i < 20; i++) expect((await post(ip, 'https://repeat.test/same.js')).statusCode).toBe(204);
    expect(await rowsFor('https://repeat.test/same.js')).toBe(1);
    // The 21st report from this IP is a new fact, so it is still on budget.
    expect((await post(ip, 'https://repeat.test/new.js')).statusCode).toBe(204);
    expect(await rowsFor('https://repeat.test/new.js')).toBe(1);
  });
});

describe('Security headers — blog video fence', () => {
  it('serves /blog-videos/ HTML under the enforced sandbox CSP only', async () => {
    const res = await app.inject({ method: 'GET', url: '/blog-videos/x/?t=1' });
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain('sandbox allow-scripts');
    expect(csp).toContain(`frame-ancestors 'self'`);
    expect(csp).toContain(`connect-src 'none'`);
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
    expect(res.payload).not.toContain('nonce=');
    expect(res.payload).toBe('<html><head></head><body><script>1</script></body></html>');
  });

  it('static-path projects are frameable same-origin only; host pages are not frameable', async () => {
    const frameAncestors = (headers: Record<string, string | string[] | undefined>) =>
      getCsp(headers).split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-ancestors'));
    const project = await app.inject({ method: 'GET', url: '/projects/escape-velocity/?v=1' });
    expect(frameAncestors(project.headers)).toBe(`frame-ancestors 'self'`);
    expect(project.headers['x-frame-options']).toBeUndefined();
    const host = await app.inject({ method: 'GET', url: '/test-html' });
    expect(frameAncestors(host.headers)).toBe(`frame-ancestors 'none'`);
    const reactRoute = await app.inject({ method: 'GET', url: '/products/session-manager' });
    expect(frameAncestors(reactRoute.headers)).toBe(`frame-ancestors 'none'`);
  });

  it('normal HTML CSP frame-src allows self', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-html' });
    const frameSrc = getCsp(res.headers).split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-src'));
    expect(frameSrc!.split(/\s+/)).toContain(`'self'`);
  });
});

describe('CSP enforcement scope', () => {
  // Static-path apps stay report-only even when BILKO_CSP_ENFORCE=1: Godot
  // needs 'unsafe-eval' (JavaScriptBridge.eval) the host policy doesn't grant.
  it('enforces on host pages only', () => {
    expect(cspIsEnforced('/', true)).toBe(true);
    expect(cspIsEnforced('/blog/post', true)).toBe(true);
    expect(cspIsEnforced('/projects/escape-velocity/', true)).toBe(false);
    expect(cspIsEnforced('/projects/escape-velocity/index.html?x=1', true)).toBe(false);
    expect(cspIsEnforced('/', false)).toBe(false);
  });
});

import Fastify from 'fastify';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerSecurityHeaders } from '../server/security-headers.js';
import { initDb, dbGet, dbRun } from '../server/db.js';

const TEST_HTML = '<html><head></head><body><script src="/app.js"></script><style>.x{}</style></body></html>';

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

  it('rate-limits after 60 requests from the same IP', async () => {
    // Use a unique IP so previous test requests don't pollute the counter
    const ip = '10.0.0.99';
    let last = 204;
    for (let i = 0; i < 65; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/csp-report',
        headers: { 'content-type': 'application/csp-report' },
        payload: JSON.stringify({ 'blocked-uri': 'x' }),
        remoteAddress: ip,
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});

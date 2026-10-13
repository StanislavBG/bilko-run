import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    expect(Buffer.byteLength(BEACON_JS)).toBeLessThan(1500);
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

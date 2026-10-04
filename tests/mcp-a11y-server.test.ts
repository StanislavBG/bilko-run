import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { startBundleServer } from '../mcp-host-server/src/gates/a11y.js';

const SLUG = 'test-gate-app';

function get(port: number, path: string): Promise<{ status: number; contentType: string | undefined; body: string }> {
  // Use an options object (not a URL string) so the raw path — including any
  // ".." segments — reaches the server untouched by WHATWG URL normalization.
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, res => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        contentType: res.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    }).on('error', reject);
  });
}

describe('startBundleServer', () => {
  let bundleDir: string;
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    bundleDir = mkdtempSync(join(tmpdir(), 'bundle-'));
    writeFileSync(join(bundleDir, 'index.html'), '<!DOCTYPE html><html><body>Hello</body></html>');
    mkdirSync(join(bundleDir, 'assets'));
    writeFileSync(join(bundleDir, 'assets', 'app.js'), 'console.log("hi");');

    const server = await startBundleServer(bundleDir, SLUG);
    port = server.port;
    close = server.close;
  });

  afterAll(async () => {
    await close();
  });

  it('serves a real asset with a JavaScript content type', async () => {
    const res = await get(port, `/projects/${SLUG}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('javascript');
    expect(res.body).toContain('console.log');
  });

  it('falls back to index.html for extension-less SPA routes', async () => {
    const res = await get(port, `/projects/${SLUG}/some/route`);
    expect(res.status).toBe(200);
    expect(res.contentType).toContain('text/html');
    expect(res.body).toContain('Hello');
  });

  it('404s on a missing asset instead of falling back to index.html', async () => {
    const res = await get(port, `/projects/${SLUG}/assets/missing.js`);
    expect(res.status).toBe(404);
  });

  it('refuses to escape bundleDir via path traversal', async () => {
    const res = await get(port, `/projects/${SLUG}/../../etc/passwd`);
    expect(res.status).toBe(404);
  });
});

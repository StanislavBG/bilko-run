/**
 * URL contract for Session Manager's consolidated web presence.
 *
 * Everything Session Manager hangs off /products/session-manager:
 *   /products/session-manager             marketing + checkout (react-route)
 *   /products/session-manager/manual      the paid Field Manual reader
 *   /products/session-manager/my-manual   purchase recovery
 *   /products/session-manager/remote      → the published web-remote bundle
 *
 * The retired top-level /manual and /my-manual must 301 here FOREVER — they are
 * printed in Stripe receipt emails already sent to customers.
 */
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RELAY_WS_PATH, RELAY_WS_PATH_CANONICAL, RELAY_WS_PATHS } from '../server/sm-relay/router.js';

const root = resolve(import.meta.dirname, '..');

describe('legacy manual URLs redirect permanently', () => {
  async function buildApp() {
    const { registerManualRoutes } = await import('../server/routes/manual.js');
    const app = Fastify({ logger: false });
    registerManualRoutes(app);
    await app.ready();
    return app;
  }

  it('301s /manual to the product-scoped path', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/manual' });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/products/session-manager/manual');
    await app.close();
  });

  it('301s /my-manual and carries the ?email= lookup across', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/my-manual?email=a%40b.com' });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/products/session-manager/my-manual?email=a%40b.com');
    await app.close();
  });

  it('serves the recovery page at the canonical path, not a redirect loop', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/products/session-manager/my-manual' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Find your manual');
    // Every link on the page points at the new root — no path can send a
    // visitor back through the 301 and re-strand them at top level.
    expect(res.body).not.toMatch(/href="\/manual"/);
    expect(res.body).not.toMatch(/action="\/my-manual"/);
    await app.close();
  });
});

describe('web-remote relay path migration', () => {
  it('still accepts the legacy path baked into already-paired devices', () => {
    expect(RELAY_WS_PATH).toBe('/projects/session-manager/relay');
    expect(RELAY_WS_PATHS).toContain(RELAY_WS_PATH);
  });

  it('also accepts the product-scoped path a future bundle will use', () => {
    expect(RELAY_WS_PATH_CANONICAL).toBe('/products/session-manager/relay');
    expect(RELAY_WS_PATHS).toContain(RELAY_WS_PATH_CANONICAL);
  });
});

describe('no stale top-level manual links survive in shipped source', () => {
  const files = [
    'src/pages/SessionManagerPage.tsx',
    'src/pages/ManualPage.tsx',
    'server/routes/stripe.ts',
  ];
  it.each(files)('%s links to the product-scoped manual', (f) => {
    const src = readFileSync(resolve(root, f), 'utf-8');
    expect(src).not.toMatch(/href="\/manual"/);
    expect(src).not.toMatch(/href="\/my-manual/);
  });
});

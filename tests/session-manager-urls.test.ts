/**
 * URL contract for Session Manager's consolidated web presence.
 *
 * Everything Session Manager hangs off /products/session-manager:
 *   /products/session-manager             marketing page (react-route)
 *   /products/session-manager/manual      the Field Manual reader (free)
 *   /products/session-manager/my-manual   "it's free now" page for past buyers
 *   /products/session-manager/remote      → the published web-remote bundle
 *
 * The retired top-level /manual and /my-manual must 301 here FOREVER — they are
 * printed in Stripe receipt emails already sent to customers.
 */
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { RELAY_WS_PATH, RELAY_WS_PATH_CANONICAL, RELAY_WS_PATHS } from '../server/sm-relay/router.js';
import { COPY } from '../src/pages/session-manager-landing/copy.js';

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
    expect(res.body).toContain('The Field Manual is free now');
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
  const LANDING_DIR = 'src/pages/session-manager-landing';
  const files = [
    'src/pages/SessionManagerPage.tsx',
    'src/pages/ManualPage.tsx',
    'server/routes/stripe.ts',
    ...readdirSync(resolve(root, LANDING_DIR))
      .filter(f => /\.(ts|tsx)$/.test(f))
      .map(f => `${LANDING_DIR}/${f}`),
  ];
  it.each(files)('%s links to the product-scoped manual', (f) => {
    const src = readFileSync(resolve(root, f), 'utf-8');
    expect(src).not.toMatch(/href="\/manual"/);
    expect(src).not.toMatch(/href="\/my-manual/);
    expect(src).not.toMatch(/["'`]\/(manual|my-manual)(["'`#?]|$)/m);
  });

  // The landing page renders its links from copy (href={COPY…}), which no
  // literal-href scan can see. Pin every href-shaped value in the copy itself.
  it('every link in the landing copy is product-scoped', () => {
    const hrefs: Array<[string, string]> = [];
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`));
      else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === 'string' && /(href|Href|HrefTemplate)$/.test(k)) hrefs.push([`${path}.${k}`, v]);
          else walk(v, `${path}.${k}`);
        }
      }
    };
    walk(COPY, 'COPY');
    expect(hrefs.map(([k]) => k)).toEqual(expect.arrayContaining([
      'COPY.meta.manualHref', 'COPY.meta.chapterHrefTemplate', 'COPY.ctas.manual.href', 'COPY.endCard.manualHref',
    ]));
    for (const [key, href] of hrefs) {
      expect(href, key).toMatch(/^\/products\/session-manager\//);
      expect(href.split(/[#?]/)[0], key).not.toMatch(/^\/(manual|my-manual)$/);
    }
  });
});

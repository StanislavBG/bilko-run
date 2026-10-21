import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { initDb, dbAll } from '../server/db.js';
import { getRelease } from '../server/services/web-products.js';
import type { WebProduct } from '../shared/web-products.js';

vi.mock('../server/clerk.js', async (orig) => ({
  ...(await orig<typeof import('../server/clerk.js')>()),
  verifyClerkToken: async (h: string | undefined) =>
    h === 'Bearer tok-user' ? 'Reader@Example.com' : null,
}));

vi.mock('../server/services/stripe.js', async (orig) => ({
  ...(await orig<typeof import('../server/services/stripe.js')>()),
  getStripe: () => null,
}));

const PREVIEW = Buffer.from([0x50, 0x4b, 0x03, 0x04, 9, 8, 7, 6]);
const PSHA = createHash('sha256').update(PREVIEW).digest('hex');
const FULL = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

const base: WebProduct = {
  slug: 'pv-fixture',
  name: 'Preview Fixture',
  productKey: 'wp_pv_fixture',
  priceEnvVar: 'STRIPE_PRICE_WP_PV_FIXTURE',
  defaultPriceId: 'price_pv_fixture',
  displayPrice: '$9',
  downloadLimit: 2,
  release: { version: '1.0.0', filename: 'pv-1.0.0.zip', bytes: FULL.length, sha256: createHash('sha256').update(FULL).digest('hex') },
  preview: { version: '1.0.0', filename: 'pv-preview-1.0.0.zip', bytes: PREVIEW.length, sha256: PSHA },
};
const noPreview: WebProduct = { ...base, slug: 'pv-none', preview: null };

async function buildApp() {
  const { registerWebProductRoutes } = await import('../server/routes/web-products.js');
  const app = Fastify();
  registerWebProductRoutes(app, { products: [base, noPreview] });
  return app;
}
type App = Awaited<ReturnType<typeof buildApp>>;

const putPreview = (app: App, slug: string, body: Buffer) =>
  app.inject({
    method: 'PUT',
    url: `/api/web-products/${slug}/releases/1.0.0?kind=preview`,
    headers: { 'content-type': 'application/zip' },
    payload: body,
  });
const getPreview = (app: App, slug: string, token?: string) =>
  app.inject({
    method: 'GET',
    url: `/api/web-products/${slug}/preview`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
const info = async (app: App, slug: string) =>
  (await app.inject({ method: 'GET', url: `/api/web-products/${slug}` })).json();

beforeAll(async () => {
  await initDb();
});

describe('preview', () => {
  it('404s when the product has no preview', async () => {
    const app = await buildApp();
    expect((await getPreview(app, 'pv-none', 'tok-user')).statusCode).toBe(404);
    expect((await info(app, 'pv-none')).previewAvailable).toBe(false);
  });

  it('upload with wrong bytes is rejected and stores nothing', async () => {
    const app = await buildApp();
    expect((await putPreview(app, base.slug, Buffer.from('nope'))).statusCode).toBe(422);
    expect(await getRelease(`${base.slug}--preview`, '1.0.0')).toBeNull();
    expect((await info(app, base.slug)).previewAvailable).toBe(false);
  });

  it('404s signed-in when bytes are not stored yet, 401s signed-out', async () => {
    const app = await buildApp();
    expect((await getPreview(app, base.slug)).statusCode).toBe(401);
    expect((await getPreview(app, base.slug, 'tok-user')).statusCode).toBe(404);
  });

  it('stores matching bytes under <slug>--preview, not the release slot', async () => {
    const app = await buildApp();
    const res = await putPreview(app, base.slug, PREVIEW);
    expect(res.statusCode).toBe(201);
    expect(await getRelease(`${base.slug}--preview`, '1.0.0')).not.toBeNull();
    expect(await getRelease(base.slug, '1.0.0')).toBeNull();
    expect((await putPreview(app, base.slug, PREVIEW)).statusCode).toBe(409);
    expect((await info(app, base.slug)).previewAvailable).toBe(true);
  });

  it('signed-out gets 401, signed-in gets the zip and a download row', async () => {
    const app = await buildApp();
    const out = await getPreview(app, base.slug);
    expect(out.statusCode).toBe(401);
    expect(out.json()).toEqual({ error: 'Sign in required.' });

    const ok = await getPreview(app, base.slug, 'tok-user');
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('application/zip');
    expect(ok.headers['content-disposition']).toContain('pv-preview-1.0.0.zip');
    expect(ok.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(ok.rawPayload).equals(PREVIEW)).toBe(true);

    const rows = await dbAll<any>(
      "SELECT * FROM web_product_downloads WHERE slug = 'pv-fixture--preview'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: '1.0.0', checkout_session_id: null, email: 'reader@example.com', via: 'preview' });
  });

  it('never resolves the storage slug as a catalog product', async () => {
    const app = await buildApp();
    expect((await getPreview(app, 'pv-fixture--preview', 'tok-user')).statusCode).toBe(404);
  });
});

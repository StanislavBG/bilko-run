import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb } from '../server/db.js';
import { recordOrder } from '../server/services/web-products.js';
import { SERVICE_SLOT_CONFIG, generateSlots } from '../shared/service-slots.js';
import type { WebProduct } from '../shared/web-products.js';

const sessionsRetrieve = vi.fn();
const sendMailMock = vi.hoisted(() => vi.fn());

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve: sessionsRetrieve } } }),
  getStripeTest: () => null,
}));

vi.mock('../server/services/mailer.js', async (orig) => ({
  ...(await orig<typeof import('../server/services/mailer.js')>()),
  sendMail: sendMailMock,
}));

const PRICE = 'price_fixture_booking';
const product: WebProduct = {
  slug: 'hfh-fixture',
  name: 'Fixture Service',
  productKey: 'wp_hfh_fixture',
  priceEnvVar: 'STRIPE_PRICE_WP_HFH_FIXTURE',
  defaultPriceId: PRICE,
  displayPrice: '$75',
  downloadLimit: 0,
  release: null,
  kind: 'service',
  billing: 'one_time',
  pageSlug: 'human-for-hire',
  sessionsPerMonth: 1,
};
const download: WebProduct = { ...product, slug: 'dl-fixture', kind: 'download', pageSlug: undefined };
const REL = { version: '1.0.0', filename: 'kit.zip', bytes: 10, sha256: 'a'.repeat(64) } as unknown as NonNullable<WebProduct['release']>;
const kit: WebProduct = { ...download, slug: 'kit-fixture', name: 'Kit Fixture', release: REL };
const kitNoRel: WebProduct = { ...download, slug: 'kit-norel', name: 'No Release Kit', release: null };
const bundle: WebProduct = { ...product, slug: 'hfh-bundle', includes: ['kit-fixture', 'kit-norel'] };

const sid = (n: string) => `cs_live_${n.padEnd(12, 'x')}`;
const S_BUNDLE = sid('bundle');
const S_HAPPY = sid('happy');
const S_OTHER = sid('other');
const S_MAILFAIL = sid('mailfail');
const S_UNPAID = sid('unpaid');
const S_BAD = sid('bad');
const S_DOUBLE = sid('double');

const INTAKE = { repo: 'https://github.com/acme/app', broken: 'agents loop', done: 'they stop', contact: 'jane@example.com' };
const slotsNow = () => generateSlots(SERVICE_SLOT_CONFIG['human-for-hire'], Date.now());

let ipN = 0;
async function buildApp(products: WebProduct[] = [product, download]) {
  const { registerServiceBookingRoutes } = await import('../server/routes/service-bookings.js');
  const app = Fastify();
  registerServiceBookingRoutes(app, { products });
  return app;
}
const book = (app: any, session: string, body: unknown, slug = product.slug) =>
  app.inject({
    method: 'POST',
    url: `/api/web-products/${slug}/booking?session_id=${session}`,
    payload: body as object,
    remoteAddress: `10.1.0.${++ipN}`,
  });

beforeAll(async () => {
  await initDb();
  for (const s of [S_HAPPY, S_OTHER, S_MAILFAIL, S_BAD, S_DOUBLE]) {
    await recordOrder({
      checkoutSessionId: s, slug: product.slug, email: 'jane@example.com',
      amountTotal: 7500, currency: 'usd', paymentStatus: 'paid',
    });
  }
});

beforeAll(async () => {
  await recordOrder({
    checkoutSessionId: S_BUNDLE, slug: bundle.slug, email: 'jane@example.com',
    amountTotal: 7500, currency: 'usd', paymentStatus: 'paid',
  });
});

beforeEach(() => {
  sessionsRetrieve.mockReset();
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ sent: true, id: 'm1' });
  process.env.BILKO_INBOX = 'BilkoBibitkov2000@gmail.com';
  process.env.MAIL_FROM = 'Bilko <bilko@bilko.run>';
});

describe('service booking routes', () => {
  it('lists slots, 404s unknown pages, excludes a claimed slot', async () => {
    const app = await buildApp();
    const before = await app.inject({ method: 'GET', url: '/api/services/human-for-hire/slots' });
    expect(before.statusCode).toBe(200);
    expect(before.headers['cache-control']).toBe('no-store');
    const b = before.json();
    expect(b.timeZone).toBe('America/Los_Angeles');
    expect(b.durationMinutes).toBe(30);
    const first = b.slots[0];

    const res = await book(app, S_HAPPY, { startMs: first.startMs, intake: INTAKE });
    expect(res.statusCode).toBe(200);
    const after = (await app.inject({ method: 'GET', url: '/api/services/human-for-hire/slots' })).json();
    expect(after.slots.find((s: any) => s.startMs === first.startMs)).toBeUndefined();

    expect((await app.inject({ method: 'GET', url: '/api/services/nope/slots' })).statusCode).toBe(404);
  });

  it('happy path returns booking, icsUrl, emailed and sends two mails', async () => {
    const app = await buildApp();
    const slot = slotsNow()[1];
    const res = await book(app, S_OTHER, { startMs: slot.startMs, intake: INTAKE });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.booking).toEqual({ startMs: slot.startMs, endMs: slot.endMs });
    expect(body.icsUrl).toContain('booking.ics');
    expect(body.emailed).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    const tos = sendMailMock.mock.calls.map((c) => c[0].to);
    expect(tos).toContain('jane@example.com');
    expect(tos).toContain('BilkoBibitkov2000@gmail.com');
    const blob = JSON.stringify(sendMailMock.mock.calls) + JSON.stringify(body);
    expect(blob.toLowerCase()).not.toContain('stanislav');
  });

  it('includes kit download links for products with includes, omitting unreleased ones', async () => {
    const app = await buildApp([bundle, kit, kitNoRel]);
    const res = await book(app, S_BUNDLE, { startMs: slotsNow()[6].startMs, intake: INTAKE }, bundle.slug);
    expect(res.statusCode).toBe(200);
    const mail = sendMailMock.mock.calls.map((c) => c[0]).find((m) => m.to === 'jane@example.com');
    const url = `https://bilko.run/api/web-products/kit-fixture/download?session_id=${S_BUNDLE}`;
    expect(mail.text).toContain(`Kit Fixture: ${url}`);
    expect(mail.html).toContain(url);
    expect(mail.text).not.toContain('kit-norel');
    expect(mail.html).not.toContain('No Release Kit');
  });

  it('409s a double claim of the same slot', async () => {
    const app = await buildApp();
    const slot = slotsNow()[2];
    expect((await book(app, S_DOUBLE, { startMs: slot.startMs, intake: INTAKE })).statusCode).toBe(200);
    const dup = await book(app, S_BAD, { startMs: slot.startMs, intake: INTAKE });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toEqual({ error: 'slot_unavailable' });
  });

  it('402s an unpaid session', async () => {
    sessionsRetrieve.mockResolvedValue({
      status: 'open', payment_status: 'unpaid', metadata: { web_product: product.slug },
    });
    const app = await buildApp();
    const res = await book(app, S_UNPAID, { startMs: slotsNow()[3].startMs, intake: INTAKE });
    expect(res.statusCode).toBe(402);
  });

  it('400s bad intake, bad startMs and bad session id; 404s non-service slug', async () => {
    const app = await buildApp();
    const startMs = slotsNow()[3].startMs;
    expect((await book(app, S_BAD, { startMs, intake: { ...INTAKE, contact: 'nope' } })).statusCode).toBe(400);
    expect((await book(app, S_BAD, { startMs, intake: { ...INTAKE, repo: 'x'.repeat(301) } })).statusCode).toBe(400);
    expect((await book(app, S_BAD, { startMs, intake: { ...INTAKE, broken: 5 } })).statusCode).toBe(400);
    expect((await book(app, S_BAD, { startMs: 'soon', intake: INTAKE })).statusCode).toBe(400);
    expect((await book(app, 'bogus', { startMs, intake: INTAKE })).statusCode).toBe(400);
    expect((await book(app, S_BAD, { startMs, intake: INTAKE }, 'dl-fixture')).statusCode).toBe(404);
    expect((await book(app, S_BAD, { startMs: startMs + 1, intake: INTAKE })).statusCode).toBe(409);
  });

  it('still returns 200 when the mailer fails', async () => {
    sendMailMock.mockResolvedValue({ sent: false, reason: 'http_500' });
    const app = await buildApp();
    const res = await book(app, S_MAILFAIL, { startMs: slotsNow()[4].startMs, intake: INTAKE });
    expect(res.statusCode).toBe(200);
    expect(res.json().emailed).toBe(false);
  });

  it('serves the .ics as text/calendar, 404 when none', async () => {
    const app = await buildApp();
    const ok = await app.inject({ method: 'GET', url: `/api/web-products/${product.slug}/booking.ics?session_id=${S_HAPPY}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toContain('text/calendar');
    expect(ok.headers['content-disposition']).toContain('bilko-session.ics');
    expect(ok.body).toContain('BEGIN:VCALENDAR');
    expect(ok.body.toLowerCase()).not.toContain('stanislav');
    const none = await app.inject({ method: 'GET', url: `/api/web-products/${product.slug}/booking.ics?session_id=${S_UNPAID}` });
    expect([402, 404]).toContain(none.statusCode);
    sessionsRetrieve.mockResolvedValue({ status: 'open', payment_status: 'unpaid', metadata: { web_product: product.slug } });
    const nobook = await app.inject({ method: 'GET', url: `/api/web-products/${product.slug}/booking.ics?session_id=${sid('nobooking')}` });
    expect([402, 404]).toContain(nobook.statusCode);
  });
});

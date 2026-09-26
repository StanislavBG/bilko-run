/**
 * Tests for the Session Manager Field Manual — free to read and download as of
 * release 2.0.1.
 *
 * What matters most here:
 *   1. the live release is free end to end: every chapter and every download
 *      opens for an anonymous visitor, and no response quotes a price;
 *   2. the Stripe wiring that used to sell it still resolves, so a late payment
 *      never falls through to the contentgrade_pro fallback;
 *   3. the chapter route's free-flag guard still behaves for a release that
 *      marks a chapter non-free: a neutral 402, and a past buyer still gets in.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { readFileSync } from 'fs';
import {
  compareManualVersions, latestManualVersion, isValidManualVersion,
  isValidManualSlug, tocFromManifest, formatManualReleaseDate,
  MANUAL_PRODUCT_KEY,
  type ManualManifest,
} from '../shared/manual-catalog.js';
import { entryForPriceType } from '../shared/product-catalog.js';

// The route-level tests run against the real release bundles on disk. The only
// seams stubbed are the purchase lookup, Clerk token verification, and — for
// the legacy-release tests — which release counts as "latest".
const hasPurchased = vi.fn(async (_email: string, _productKey: string) => false);
vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: (email: string, productKey: string) => hasPurchased(email, productKey),
}));

let currentAuthEmail: string | null = null;
vi.mock('../server/clerk.js', () => ({
  EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  verifyClerkToken: async (authHeader: string | undefined) => {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return currentAuthEmail;
  },
}));

/** When set, the routes serve this on-disk release instead of the newest one. */
let pinnedVersion: string | null = null;
vi.mock('../server/services/manual.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/services/manual.js')>();
  return {
    ...actual,
    latestManifest: () => (pinnedVersion ? actual.readManifest(pinnedVersion) : actual.latestManifest()),
  };
});

const MANIFEST: ManualManifest = {
  version: '1.0.0',
  releasedAt: '2026-08-07',
  title: 'The Session Manager Field Manual',
  summary: 'A tab-by-tab operator guide.',
  documentsAppVersion: '0.64.0',
  chapters: [
    { slug: 'getting-started', title: 'Getting Started', blurb: 'Setup.', free: true, file: 'getting-started.html', part: 'Onboarding' },
    { slug: 'scheduler', title: 'Scheduler', blurb: 'Queue work.', file: 'scheduler.html' },
  ],
  assets: [
    { id: 'offline-html', label: 'Offline HTML edition', file: 'field-manual-1.0.0.html', mime: 'text/html', bytes: 19481 },
    { id: 'pdf', label: 'PDF', file: 'field-manual-1.0.0.pdf', mime: 'application/pdf', bytes: 2048 },
  ],
};

/** A price in any form — the free manual's responses must never quote one. */
const PRICE_RE = /\$\s?\d|priceLabel/;

describe('manual catalog', () => {
  it('keeps the session_manager SKU resolvable so a late payment still lands on it', () => {
    // Nothing sells the manual any more, but a payment already in flight must
    // resolve to session_manager at checkout success — never to the
    // contentgrade_pro fallback that hands out a Pro license key.
    expect(MANUAL_PRODUCT_KEY).toBe('session_manager');
    const entry = entryForPriceType('session_manager');
    expect(entry).toBeDefined();
    expect(entry!.mode).toBe('payment');
    expect(entry!.envVar).toBe('STRIPE_PRICE_SESSION_MANAGER');
    expect(entry!.productKey).toBe(MANUAL_PRODUCT_KEY);
  });

  it('orders versions numerically, not lexically', () => {
    // '10' < '9' as strings — the exact bug a naive sort would ship.
    expect(compareManualVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(latestManualVersion(['1.0.0', '1.10.0', '1.9.0', '2.0.0'])).toBe('2.0.0');
    expect(latestManualVersion([])).toBeNull();
  });

  it('rejects version and slug strings that could escape a directory', () => {
    expect(isValidManualVersion('1.0.0')).toBe(true);
    for (const bad of ['../1.0.0', '1.0', 'latest', '1.0.0/../..', '']) {
      expect(isValidManualVersion(bad)).toBe(false);
    }
    expect(isValidManualSlug('getting-started')).toBe(true);
    for (const bad of ['../secret', 'Getting-Started', 'a/b', '', '-leading']) {
      expect(isValidManualSlug(bad)).toBe(false);
    }
  });

  it('never leaks chapter bodies or file paths into the public TOC', () => {
    const toc = tocFromManifest(MANIFEST);
    const serialized = JSON.stringify(toc);
    expect(serialized).not.toContain('.html');
    expect(serialized).not.toContain('.pdf');
    expect(toc.chapters.map(c => c.free)).toEqual([true, false]);
    expect(toc.chapters[0].title).toBe('Getting Started');
  });

  it('carries a chapter\'s part through into the TOC, omitting it when absent', () => {
    const toc = tocFromManifest(MANIFEST);
    expect(toc.chapters[0].part).toBe('Onboarding');
    expect(toc.chapters[1].part).toBeUndefined();
  });

  it('formats the release date without a local-timezone day shift', () => {
    // A date-only ISO string parses as UTC midnight; formatting in local time
    // (e.g. America/Los_Angeles, UTC-7/8) would render the previous day.
    const formatted = formatManualReleaseDate('2026-09-25');
    expect(formatted).toContain('25');
    expect(formatted).not.toContain('24');
  });
});

describe('release bundle on disk', () => {
  it('exposes the latest bundle with every chapter and asset it advertises', async () => {
    const { listManualVersions, latestManifest, findChapter, readChapterHtml, resolveReleaseFile } =
      await import('../server/services/manual.js');

    const versions = listManualVersions();
    expect(versions.length).toBeGreaterThan(0);

    const m = latestManifest();
    expect(m).not.toBeNull();

    // Every chapter and asset the manifest advertises must actually exist —
    // a manifest that over-promises hands readers a broken page.
    for (const c of m!.chapters) {
      expect(readChapterHtml(m!.version, c), `chapter ${c.slug}`).toBeTruthy();
    }
    for (const a of m!.assets) {
      expect(resolveReleaseFile(m!.version, a.file), `asset ${a.id}`).toBeTruthy();
    }

    expect(findChapter(m!, 'no-such-chapter')).toBeNull();
    // A traversal-shaped slug must be rejected before it ever hits the fs.
    expect(findChapter(m!, '../../../etc/passwd')).toBeNull();
  });

  it('ships 2.0.1 or newer as the latest release, with every chapter free', async () => {
    // The manual went free in 2.0.1. The server only ever serves the newest
    // release, so this is the assertion that the live manual is free.
    const { latestManifest } = await import('../server/services/manual.js');
    const m = latestManifest()!;
    expect(compareManualVersions(m.version, '2.0.1')).toBeGreaterThanOrEqual(0);
    const nonFree = m.chapters.filter(c => !c.free).map(c => c.slug);
    expect(nonFree, 'chapters still marked non-free').toEqual([]);
  });

  it('refuses to resolve a file outside the release directory', async () => {
    const { resolveReleaseFile, latestManifest } = await import('../server/services/manual.js');
    const m = latestManifest()!;
    expect(resolveReleaseFile(m.version, '../../../../etc/passwd')).toBeNull();
    expect(resolveReleaseFile('../..', 'manifest.json')).toBeNull();
  });
});

async function buildApp() {
  const { registerManualRoutes } = await import('../server/routes/manual.js');
  const app = Fastify({ logger: false });
  registerManualRoutes(app);
  await app.ready();
  return app;
}

function authAs(email: string | null) {
  currentAuthEmail = email;
}

const BEARER = { authorization: 'Bearer test-token' };
const BUYER = 'buyer@entitled-test.com';

beforeEach(() => {
  hasPurchased.mockReset();
  hasPurchased.mockResolvedValue(false);
  authAs(null);
  pinnedVersion = null;
});

afterEach(() => {
  authAs(null);
  pinnedVersion = null;
});

describe('free manual (route-level, latest release)', () => {
  it('serves the toc, every chapter and every download to an anonymous visitor', async () => {
    const app = await buildApp();

    const tocRes = await app.inject({ method: 'GET', url: '/api/manual/toc' });
    expect(tocRes.statusCode).toBe(200);
    expect(tocRes.body).not.toMatch(PRICE_RE);
    const { free, toc } = tocRes.json();
    expect(free).toBe(true);
    expect(toc.chapters.length).toBeGreaterThan(0);
    expect(toc.assets.length).toBeGreaterThan(0);

    for (const c of toc.chapters as Array<{ slug: string }>) {
      const res = await app.inject({ method: 'GET', url: `/api/manual/chapter/${c.slug}` });
      expect(res.statusCode, `chapter ${c.slug}`).toBe(200);
      expect(res.json().html.length, `chapter ${c.slug}`).toBeGreaterThan(0);
    }

    for (const a of toc.assets as Array<{ id: string; bytes: number }>) {
      const res = await app.inject({ method: 'GET', url: `/api/manual/download/${a.id}` });
      expect(res.statusCode, `asset ${a.id}`).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.rawPayload.length, `asset ${a.id}`).toBe(a.bytes);
    }

    // Free means free: nothing on the read or download path asks who you are.
    expect(hasPurchased).not.toHaveBeenCalled();
    await app.close();
  });

  it('serves every download byte-for-byte behind the production security headers', async () => {
    // The CSP hook rewrites text/html responses (nonces, a <meta>, no-store).
    // The offline edition IS text/html, so without the attachment exemption a
    // visitor would save a file that differs from the one the manifest lists.
    const { registerManualRoutes } = await import('../server/routes/manual.js');
    const { registerSecurityHeaders } = await import('../server/security-headers.js');
    const { latestManifest, resolveReleaseFile } = await import('../server/services/manual.js');
    const app = Fastify({ logger: false });
    registerSecurityHeaders(app);
    registerManualRoutes(app);
    await app.ready();

    const m = latestManifest()!;
    const html = m.assets.find(a => a.mime.startsWith('text/html'));
    expect(html, 'the latest release ships an offline HTML edition').toBeDefined();
    for (const a of m.assets) {
      const res = await app.inject({ method: 'GET', url: `/api/manual/download/${a.id}` });
      expect(res.statusCode, `asset ${a.id}`).toBe(200);
      expect(res.headers['cache-control'], `asset ${a.id}`).toBe('no-cache');
      expect(res.rawPayload.length, `asset ${a.id}`).toBe(a.bytes);
      expect(res.rawPayload.equals(readFileSync(resolveReleaseFile(m.version, a.file)!)), `asset ${a.id} bytes`).toBe(true);
      expect(res.rawPayload.toString('latin1')).not.toContain('csp-nonce');
    }

    // Ordinary HTML pages still get the nonce treatment.
    const page = await app.inject({ method: 'GET', url: '/products/session-manager/my-manual' });
    expect(page.headers['cache-control']).toBe('private, no-store');
    expect(page.body).toContain('<meta name="csp-nonce"');
    await app.close();
  });

  it('lets a browser or edge cache revalidate a download for a bodiless 304', async () => {
    // Behind the production hooks: the CSP rewrite and origin compression must
    // not turn a 304 into a body, or strip the validator it depends on.
    const compress = (await import('@fastify/compress')).default;
    const { registerManualRoutes } = await import('../server/routes/manual.js');
    const { registerSecurityHeaders } = await import('../server/security-headers.js');
    const { latestManifest } = await import('../server/services/manual.js');
    const app = Fastify({ logger: false });
    registerSecurityHeaders(app);
    await app.register(compress, { threshold: 1024, encodings: ['br', 'gzip'] });
    registerManualRoutes(app);
    await app.ready();

    const m = latestManifest()!;
    for (const a of m.assets) {
      const url = `/api/manual/download/${a.id}`;
      const first = await app.inject({ method: 'GET', url });
      expect(first.statusCode, `asset ${a.id}`).toBe(200);
      const etag = String(first.headers.etag);
      expect(etag, `asset ${a.id}`).toBe(`W/"${m.version}-${a.id}-${a.bytes}"`);
      expect(first.headers['cache-control']).toBe('no-cache');

      // The browser's own tag, Cloudflare's weakened copy, a list, and `*` all match.
      for (const inm of [etag, etag.replace(/^W\//, ''), `"stale", ${etag}`, '*']) {
        const again = await app.inject({ method: 'GET', url, headers: { 'if-none-match': inm } });
        expect(again.statusCode, `asset ${a.id} If-None-Match: ${inm}`).toBe(304);
        expect(again.rawPayload.length, `asset ${a.id} If-None-Match: ${inm}`).toBe(0);
        expect(again.headers.etag).toBe(etag);
        expect(again.headers['cache-control']).toBe('no-cache');
      }

      // A tag from an older release is a miss: the full file comes back.
      const stale = await app.inject({ method: 'GET', url, headers: { 'if-none-match': `W/"1.0.0-${a.id}-1"` } });
      expect(stale.statusCode, `asset ${a.id}`).toBe(200);
      expect(stale.rawPayload.length, `asset ${a.id}`).toBe(a.bytes);
    }
    await app.close();
  });

  it('rejects malformed and unknown download ids', async () => {
    const app = await buildApp();
    expect((await app.inject({ method: 'GET', url: '/api/manual/download/Bad_Id' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/manual/download/no-such-asset' })).statusCode).toBe(404);
    await app.close();
  });

  it('points a past buyer\'s receipt link at the free reader, not a purchase lookup', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/products/session-manager/my-manual?email=buyer%40x.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('The Field Manual is free now');
    expect(res.body).toContain('href="/products/session-manager/manual"');
    expect(res.body).not.toMatch(PRICE_RE);
    expect(res.body).not.toMatch(/\bbuy\b|find my purchase|<form/i);
    expect(hasPurchased).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('a release that still marks chapters non-free (legacy 1.0.0 on disk)', () => {
  beforeEach(() => {
    pinnedVersion = '1.0.0';
  });

  it('answers a neutral 402 for a non-free chapter — never a price or a buy prompt', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/manual/chapter/scheduler' });
    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.locked).toBe(true);
    expect(body.title).toBeTruthy();
    expect(body.error).toMatch(/isn't available right now/);
    expect(res.body).not.toMatch(PRICE_RE);
    expect(res.body).not.toMatch(/\bbuy\b|purchase|unlock|paid/i);

    // The chapter the release does mark free still reads for anyone.
    const free = await app.inject({ method: 'GET', url: '/api/manual/chapter/getting-started' });
    expect(free.statusCode).toBe(200);

    await app.close();
  });

  it('still opens a non-free chapter for a pre-2.0.1 buyer', async () => {
    hasPurchased.mockImplementation(async (email, productKey) => email === BUYER && productKey === MANUAL_PRODUCT_KEY);
    authAs(BUYER);
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/api/manual/chapter/scheduler', headers: BEARER });
    expect(res.statusCode).toBe(200);
    expect(res.json().html.length).toBeGreaterThan(0);

    await app.close();
  });

  it('serves downloads to anyone, whatever the chapter flags say', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/manual/download/pdf' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.rawPayload.length).toBe(128193);
    expect(hasPurchased).not.toHaveBeenCalled();
    await app.close();
  });
});

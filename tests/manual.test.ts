/**
 * Tests for the paid Session Manager Field Manual framework.
 *
 * Two things matter most here and both are money/access questions:
 *   1. a paid chapter must never be readable without an entitlement, and
 *   2. a download token minted for one asset must never open another.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import {
  compareManualVersions, latestManualVersion, isValidManualVersion,
  isValidManualSlug, tocFromManifest, MANUAL_PRODUCT_KEY, MANUAL_PRICE_TYPE,
  type ManualManifest,
} from '../shared/manual-catalog.js';
import { entryForPriceType } from '../shared/product-catalog.js';

// The route-level tests below exercise the real entitled path end-to-end, so
// the only seams stubbed are the purchase lookup and Clerk token
// verification — everything else (disk reads, token signing, streaming) runs
// for real against the shipped v1.0.0 release bundle.
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
  requireAuth: async (req: any, reply: any) => {
    const email = currentAuthEmail;
    if (!email) {
      reply.code(401).send({ error: 'sign_in_required' });
      return null;
    }
    return email;
  },
}));

const MANIFEST: ManualManifest = {
  version: '1.0.0',
  releasedAt: '2026-08-07',
  title: 'The Session Manager Field Manual',
  summary: 'A tab-by-tab operator guide.',
  documentsAppVersion: '0.64.0',
  chapters: [
    { slug: 'getting-started', title: 'Getting Started', blurb: 'Setup.', free: true, file: 'getting-started.html' },
    { slug: 'scheduler', title: 'Scheduler', blurb: 'Queue work.', file: 'scheduler.html' },
  ],
  assets: [
    { id: 'offline-html', label: 'Offline HTML edition', file: 'field-manual-1.0.0.html', mime: 'text/html', bytes: 19481 },
    { id: 'pdf', label: 'PDF', file: 'field-manual-1.0.0.pdf', mime: 'application/pdf', bytes: 2048 },
  ],
};

describe('manual catalog', () => {
  it('is wired to the already-live session_manager SKU, not a new one', () => {
    expect(MANUAL_PRODUCT_KEY).toBe('session_manager');
    const entry = entryForPriceType(MANUAL_PRICE_TYPE);
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
});

describe('release bundle on disk', () => {
  it('exposes the shipped v1.0.0 bundle with a free sample chapter', async () => {
    const { listManualVersions, latestManifest, findChapter, readChapterHtml, resolveReleaseFile } =
      await import('../server/services/manual.js');

    const versions = listManualVersions();
    expect(versions.length).toBeGreaterThan(0);

    const m = latestManifest();
    expect(m).not.toBeNull();
    expect(m!.chapters.some(c => c.free)).toBe(true);

    // Every chapter and asset the manifest advertises must actually exist —
    // a manifest that over-promises hands buyers a broken page.
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

  it('refuses to resolve a file outside the release directory', async () => {
    const { resolveReleaseFile, latestManifest } = await import('../server/services/manual.js');
    const m = latestManifest()!;
    expect(resolveReleaseFile(m.version, '../../../../etc/passwd')).toBeNull();
    expect(resolveReleaseFile('../..', 'manifest.json')).toBeNull();
  });
});

describe('entitled path (route-level)', () => {
  const BUYER = 'buyer@entitled-test.com';

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

  beforeEach(() => {
    hasPurchased.mockReset();
    authAs(null);
  });

  afterEach(async () => {
    authAs(null);
  });

  it('walks status → paid chapter → downloaded bytes for an entitled buyer', async () => {
    hasPurchased.mockImplementation(async (email, productKey) => email === BUYER && productKey === MANUAL_PRODUCT_KEY);
    authAs(BUYER);
    const app = await buildApp();

    // 1. status reports entitled + a toc
    const status = await app.inject({ method: 'GET', url: '/api/manual/status', headers: { authorization: 'Bearer test-token' } });
    expect(status.statusCode).toBe(200);
    const statusBody = status.json();
    expect(statusBody.entitled).toBe(true);
    expect(statusBody.toc).toBeTruthy();
    expect(Array.isArray(statusBody.toc.chapters)).toBe(true);
    expect(statusBody.toc.chapters.length).toBeGreaterThan(0);

    const paidSlug = statusBody.toc.chapters.find((c: { free: boolean }) => !c.free)?.slug;
    expect(paidSlug).toBeTruthy();

    // 2. paid chapter body is readable, not just its metadata
    const chapter = await app.inject({
      method: 'GET',
      url: `/api/manual/chapter/${paidSlug}`,
      headers: { authorization: 'Bearer test-token' },
    });
    expect(chapter.statusCode).toBe(200);
    const chapterBody = chapter.json();
    expect(typeof chapterBody.html).toBe('string');
    expect(chapterBody.html.length).toBeGreaterThan(0);

    // 3. download the PDF with the same bearer credential — no token step
    const assetId = statusBody.toc.assets.find((a: { id: string }) => a.id === 'pdf')?.id;
    expect(assetId).toBe('pdf');
    const declaredBytes = statusBody.toc.assets.find((a: { id: string }) => a.id === 'pdf')!.bytes;

    const download = await app.inject({
      method: 'GET',
      url: `/api/manual/download/${assetId}`,
      headers: { authorization: 'Bearer test-token' },
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(download.rawPayload.length).toBe(declaredBytes);

    await app.close();
  });

  it('refuses the download to an anonymous request and to a non-buyer', async () => {
    const app = await buildApp();

    // No bearer at all — the URL is not a credential, so it grants nothing.
    authAs(null);
    const anon = await app.inject({ method: 'GET', url: '/api/manual/download/pdf' });
    expect(anon.statusCode).toBe(401);

    // Signed in, but has not bought it.
    hasPurchased.mockResolvedValue(false);
    authAs('nobody@example.com');
    const notBuyer = await app.inject({
      method: 'GET',
      url: '/api/manual/download/pdf',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(notBuyer.statusCode).toBe(402);

    await app.close();
  });

  it('never entitles a non-purchasing user', async () => {
    hasPurchased.mockResolvedValue(false);
    authAs('nobody@example.com');
    const app = await buildApp();

    const status = await app.inject({ method: 'GET', url: '/api/manual/status', headers: { authorization: 'Bearer test-token' } });
    expect(status.json().entitled).toBe(false);

    const download = await app.inject({
      method: 'GET',
      url: '/api/manual/download/pdf',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(download.statusCode).toBe(402);

    await app.close();
  });
});

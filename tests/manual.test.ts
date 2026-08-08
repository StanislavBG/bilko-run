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

describe('download tokens', () => {
  // Import lazily so the env var below is set before the module caches a secret.
  async function svc() {
    process.env.MANUAL_DOWNLOAD_SECRET = 'test-secret-for-manual-downloads';
    return import('../server/services/manual.js');
  }

  beforeEach(() => { vi.restoreAllMocks(); });

  it('round-trips a token for the asset it was minted for', async () => {
    const { mintDownloadToken, verifyDownloadToken } = await svc();
    const token = mintDownloadToken({ email: 'buyer@example.com', version: '1.0.0', assetId: 'pdf' });
    const claims = verifyDownloadToken(token, { version: '1.0.0', assetId: 'pdf' });
    expect(claims?.email).toBe('buyer@example.com');
  });

  it('refuses a token minted for a different asset or version', async () => {
    const { mintDownloadToken, verifyDownloadToken } = await svc();
    const token = mintDownloadToken({ email: 'buyer@example.com', version: '1.0.0', assetId: 'pdf' });
    expect(verifyDownloadToken(token, { version: '1.0.0', assetId: 'offline-html' })).toBeNull();
    expect(verifyDownloadToken(token, { version: '2.0.0', assetId: 'pdf' })).toBeNull();
  });

  it('refuses an expired token', async () => {
    const { mintDownloadToken, verifyDownloadToken, DOWNLOAD_TOKEN_TTL_MS } = await svc();
    const now = 1_700_000_000_000;
    const token = mintDownloadToken({ email: 'a@b.com', version: '1.0.0', assetId: 'pdf' }, now);
    expect(verifyDownloadToken(token, { version: '1.0.0', assetId: 'pdf' }, now + 1000)).not.toBeNull();
    expect(verifyDownloadToken(token, { version: '1.0.0', assetId: 'pdf' }, now + DOWNLOAD_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it('refuses a tampered payload and malformed input without throwing', async () => {
    const { mintDownloadToken, verifyDownloadToken } = await svc();
    const token = mintDownloadToken({ email: 'a@b.com', version: '1.0.0', assetId: 'pdf' });
    const [body, sig] = token.split('.');

    // Re-encode the payload with a longer expiry but keep the original signature.
    const forgedBody = Buffer.from(JSON.stringify({
      email: 'a@b.com', version: '1.0.0', assetId: 'pdf', exp: Date.now() + 10 ** 9,
    })).toString('base64url');
    expect(verifyDownloadToken(`${forgedBody}.${sig}`, { version: '1.0.0', assetId: 'pdf' })).toBeNull();

    // A signature of a different length must not blow up timingSafeEqual.
    for (const bad of ['', 'garbage', `${body}.`, `.${sig}`, `${body}.short`, `${body}.${sig}extra`]) {
      expect(() => verifyDownloadToken(bad, { version: '1.0.0', assetId: 'pdf' })).not.toThrow();
      expect(verifyDownloadToken(bad, { version: '1.0.0', assetId: 'pdf' })).toBeNull();
    }
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
    process.env.MANUAL_DOWNLOAD_SECRET = 'test-secret-for-manual-downloads';
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

  it('walks status → paid chapter → download-token → streamed bytes for an entitled buyer', async () => {
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

    // 3. mint a download token for the PDF asset
    const assetId = statusBody.toc.assets.find((a: { id: string }) => a.id === 'pdf')?.id;
    expect(assetId).toBe('pdf');
    const mint = await app.inject({
      method: 'POST',
      url: '/api/manual/download-token',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      payload: { assetId },
    });
    expect(mint.statusCode).toBe(200);
    const mintBody = mint.json();
    expect(typeof mintBody.url).toBe('string');
    expect(mintBody.bytes).toBeGreaterThan(0);

    // 4. the minted URL streams the full declared byte count with the right headers
    const download = await app.inject({ method: 'GET', url: mintBody.url });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(download.rawPayload.length).toBe(mintBody.bytes);

    await app.close();
  });

  it('mints a token that unlocks only the asset it names, even for an entitled buyer', async () => {
    hasPurchased.mockImplementation(async (email, productKey) => email === BUYER && productKey === MANUAL_PRODUCT_KEY);
    authAs(BUYER);
    const app = await buildApp();

    const status = await app.inject({ method: 'GET', url: '/api/manual/status', headers: { authorization: 'Bearer test-token' } });
    const { toc } = status.json();
    const assetIds: string[] = toc.assets.map((a: { id: string }) => a.id);
    expect(assetIds).toContain('offline-html');
    expect(assetIds).toContain('pdf');

    const mint = await app.inject({
      method: 'POST',
      url: '/api/manual/download-token',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      payload: { assetId: 'pdf' },
    });
    const { url } = mint.json();

    // Swap the token's target asset in the URL — the token was signed for
    // 'pdf' only, so redirecting it at 'offline-html' must be refused rather
    // than acting as a general-purpose bearer credential for the release.
    const swapped = url.replace(`/api/manual/download/1.0.0/pdf`, `/api/manual/download/1.0.0/offline-html`);
    expect(swapped).not.toBe(url);

    const res = await app.inject({ method: 'GET', url: swapped });
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('never entitles a non-purchasing user', async () => {
    hasPurchased.mockResolvedValue(false);
    authAs('nobody@example.com');
    const app = await buildApp();

    const status = await app.inject({ method: 'GET', url: '/api/manual/status', headers: { authorization: 'Bearer test-token' } });
    expect(status.json().entitled).toBe(false);

    const mint = await app.inject({
      method: 'POST',
      url: '/api/manual/download-token',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      payload: { assetId: 'pdf' },
    });
    expect(mint.statusCode).toBe(402);

    await app.close();
  });
});

/**
 * og-card-cache-harness — end-to-end proof (real Chromium, real host code) that a card <img>
 * inserted after window load, as on /projects, shows a newly published share image on the next
 * normal visit when its src comes from cardImageUrl(), and (control) stays stale with the old
 * unversioned /og/<slug>.png URL under 'public, max-age=86400'.
 *
 * Run: pnpm exec tsx scripts/og-card-cache-harness.ts
 * Prints HARNESS: PASS and exits 0, or one HALT: line and exits 1. Network: 127.0.0.1 only.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { Browser, Page } from '@playwright/test';
import { registerOgRoutes } from '../server/og-routes.js';
import { buildAssetVersions } from '../shared/asset-versions.js';
import { cardImageUrl } from '../src/data/assetVersions.js';

const SLUG = 'demo';
const SHARE_PATH = `/projects/${SLUG}/og.png`;
const WAIT_MS = 15_000;
const REGISTRY = [
  { slug: SLUG, name: 'Demo', tagline: 'Demo tagline', category: 'utility', listing: { shareImage: SHARE_PATH } },
];

class HarnessError extends Error {}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new HarnessError(msg);
}

function solidPng(fill: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${fill}"/></svg>`;
  return Buffer.from(new Resvg(svg).render().asPng());
}

function pageHtml(src: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>card harness</title></head><body>
<script>
window.addEventListener('load', function () {
  var img = document.createElement('img');
  img.id = 'card';
  img.src = ${JSON.stringify(src)};
  document.body.appendChild(img);
});
</script></body></html>`;
}

interface Harness {
  app: FastifyInstance;
  base: string;
  ogRequests: string[];
}

/**
 * fixed: the real registerOgRoutes, page src from cardImageUrl over a freshly computed map.
 * control: a test-only /og/:file wrapper serving the current bytes with
 * 'public, max-age=86400' and no validators (production before this plan), page src unversioned.
 */
async function startServer(mode: 'fixed' | 'control', staticRoot: string): Promise<Harness> {
  const app = Fastify();
  const ogRequests: string[] = [];
  app.addHook('onRequest', async req => {
    if (req.url.startsWith('/og/')) ogRequests.push(req.url);
  });

  if (mode === 'fixed') {
    registerOgRoutes(app, {
      projects: REGISTRY.map(r => ({ slug: r.slug, name: r.name, tagline: r.tagline, category: r.category, shareImage: SHARE_PATH })),
      blogPosts: [],
      staticRoot,
    });
  } else {
    app.get<{ Params: { file: string } }>('/og/:file', async (req, reply) => {
      if (req.params.file !== `${SLUG}.png`) return reply.code(404).send('Not found');
      const bytes = readFileSync(join(staticRoot, SHARE_PATH.slice(1)));
      reply.header('cache-control', 'public, max-age=86400');
      return reply.type('image/png').send(bytes);
    });
  }

  app.get('/page', async (_req, reply) => {
    // Recomputed per request: the map the next deploy would bake from the current bytes.
    const src = mode === 'fixed' ? cardImageUrl(SLUG, buildAssetVersions(REGISTRY, staticRoot)) : `/og/${SLUG}.png`;
    reply.header('cache-control', 'no-store');
    return reply.type('text/html; charset=utf-8').send(pageHtml(src));
  });

  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  assert(addr && typeof addr === 'object', 'server did not bind a TCP port');
  return { app, base: `http://127.0.0.1:${addr.port}`, ogRequests };
}

/** Centre pixel of #card as 'r,g,b', read by drawing the loaded image onto a canvas. */
async function visitAndReadCentre(page: Page, url: string): Promise<{ src: string; rgb: [number, number, number] }> {
  await page.goto(url, { timeout: WAIT_MS, waitUntil: 'load' });
  await page.waitForFunction(
    () => {
      const img = document.getElementById('card') as HTMLImageElement | null;
      return !!img && img.complete && img.naturalWidth > 0;
    },
    undefined,
    { timeout: WAIT_MS },
  );
  return page.evaluate(() => {
    const img = document.getElementById('card') as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return { src: img.getAttribute('src') ?? '', rgb: [d[0], d[1], d[2]] as [number, number, number] };
  });
}

function colourName([r, g, b]: [number, number, number]): string {
  if (r > 200 && g < 50 && b < 50) return 'red';
  if (b > 200 && r < 50 && g < 50) return 'blue';
  return `rgb(${r},${g},${b})`;
}

async function runScenario(browser: Browser, mode: 'fixed' | 'control', red: Buffer, blue: Buffer): Promise<void> {
  const staticRoot = mkdtempSync(join(tmpdir(), `og-card-harness-${mode}-`));
  let harness: Harness | undefined;
  const context = await browser.newContext();
  try {
    mkdirSync(join(staticRoot, 'projects', SLUG), { recursive: true });
    const file = join(staticRoot, SHARE_PATH.slice(1));
    writeFileSync(file, red);
    harness = await startServer(mode, staticRoot);
    const page = await context.newPage();

    const first = await visitAndReadCentre(page, `${harness.base}/page`);
    assert(harness.ogRequests.length === 1, `${mode}: expected 1 /og request on first visit, saw ${harness.ogRequests.length}`);
    assert(colourName(first.rgb) === 'red', `${mode}: first visit showed ${colourName(first.rgb)}, expected red`);

    // Publish: new share image bytes; the page route recomputes the map on the next request.
    writeFileSync(file, blue);

    const second = await visitAndReadCentre(page, `${harness.base}/page`);
    const seen = colourName(second.rgb);
    console.log(`${mode}: visit1 src=${first.src} visit2 src=${second.src} /og requests=${JSON.stringify(harness.ogRequests)} visit2 colour=${seen}`);

    if (mode === 'fixed') {
      assert(first.src !== second.src, `fixed: card src did not change after publish (${second.src})`);
      assert(harness.ogRequests.length as number === 2, `fixed: expected a second /og request after publish, saw ${harness.ogRequests.length}`);
      assert(seen === 'blue', `fixed: second visit showed ${seen}, expected blue`);
      console.log('FIXED: fresh after publish');
    } else {
      assert(harness.ogRequests.length === 1, `control: expected no second /og request, saw ${harness.ogRequests.length}`);
      assert(seen === 'red', `control: second visit showed ${seen}, expected stale red`);
      console.log('CONTROL: stale as expected');
    }
  } finally {
    await context.close().catch(() => {});
    if (harness) await harness.app.close().catch(() => {});
    rmSync(staticRoot, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  let browser: Browser | undefined;
  try {
    const red = solidPng('#ff0000');
    const blue = solidPng('#0000ff');
    // 'playwright' is only transitive here; @playwright/test re-exports chromium.
    const { chromium } = await import('@playwright/test');
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      throw new HarnessError(`Chromium unavailable (run: pnpm exec playwright install chromium): ${String(err).split('\n')[0]}`);
    }
    await runScenario(browser, 'fixed', red, blue);
    await runScenario(browser, 'control', red, blue);
    console.log('HARNESS: PASS');
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`HALT: ${msg.split('\n')[0]}`);
    return 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

main().then(code => process.exit(code));

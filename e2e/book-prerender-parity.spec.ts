import { test, expect, type Browser, type BrowserContext } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { renderBookingPageShell } from '../server/bilko-profile-routes';

// Server-rendered /book (no JS) must put the booking content where React puts it,
// and carry the site header, Primary nav and bottom bar. Runs against a production
// build in dist/, served through page routing on a fixed origin; starts no server.

const DIST = join(process.cwd(), 'dist');
const INDEX = join(DIST, 'index.html');
const ORIGIN = 'http://book.test';

const H = 3600000;
const D = 24 * H;
const T = Date.now() + 3 * D;
const nineSlots = {
  timeZone: 'America/Los_Angeles',
  durationMinutes: 60,
  slots: [0, 1, 2, 7, 8, 9, 14, 15, 16].map((d) => ({ startMs: T + d * D, endMs: T + d * D + H })),
  taken: [],
};

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

async function makeContext(browser: Browser, width: number, height: number, js: boolean): Promise<BrowserContext> {
  const bookHtml = renderBookingPageShell(readFileSync(INDEX, 'utf8'));
  const context = await browser.newContext({
    viewport: { width, height },
    timezoneId: 'America/Los_Angeles',
    javaScriptEnabled: js,
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      // Third parties (Google Fonts, Clerk) are cut off the same way in both renders,
      // so both use the same fallback fonts.
      return route.abort();
    }
    const p = url.pathname;
    if (p === '/book' || p === '/book/') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: bookHtml });
    }
    if (p === '/api/services/human-for-hire/slots') {
      return route.fulfill({ status: 200, json: nineSlots });
    }
    if (p.startsWith('/api/')) {
      return route.fulfill({ status: 404, json: { error: 'not found' } });
    }
    const file = normalize(join(DIST, decodeURIComponent(p)));
    if (!file.startsWith(DIST + sep) || !existsSync(file) || !statSync(file).isFile()) {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    }
    return route.fulfill({
      status: 200,
      contentType: TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      body: readFileSync(file),
    });
  });
  return context;
}

const SELECTORS = ['.booking-page .bk-h1', '.booking-page .bk-card'] as const;

for (const [w, h] of [
  [1280, 720],
  [390, 844],
] as const) {
  test(`server-rendered /book lines up with the React page at ${w}x${h}`, async ({ browser }) => {
    test.skip(!existsSync(INDEX), 'dist/index.html is missing: run `pnpm build` first');

    const noJs = await makeContext(browser, w, h, false);
    const withJs = await makeContext(browser, w, h, true);
    try {
      const a = await noJs.newPage();
      await a.goto(`${ORIGIN}/book`);
      await expect(a.locator('header.bk-header')).toHaveCount(1);
      await expect(a.locator('footer.bk-bottombar')).toHaveCount(1);
      // CSS hides the nav on phones, so find it by markup there and by role on desktop.
      const navEl = a.locator('header.bk-header nav[aria-label="Primary"]');
      await expect(navEl).toHaveCount(1);
      await expect(navEl.locator('a[href="/book"]')).toHaveAttribute('aria-current', 'page');
      if (w >= 1024) {
        const nav = a.getByRole('navigation', { name: 'Primary' });
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link', { name: /Hire/ })).toHaveAttribute('aria-current', 'page');
        expect(await nav.getByRole('link').count()).toBeGreaterThan(1);
      }
      for (const s of SELECTORS) await expect(a.locator(s)).toHaveCount(1);

      const b = await withJs.newPage();
      await b.goto(`${ORIGIN}/book`);
      await expect(b.locator('button.bk-slot').first()).toBeVisible();
      await expect(b.locator('header.bk-header')).toHaveCount(1);

      const tops = (sels: readonly string[]) =>
        sels.map((s) => document.querySelector(s)!.getBoundingClientRect().top);
      const server = await a.evaluate(tops, SELECTORS);
      const react = await b.evaluate(tops, SELECTORS);
      SELECTORS.forEach((s, i) => {
        expect(Math.abs(server[i] - react[i]), `${s} top: server ${server[i]} vs React ${react[i]}`).toBeLessThanOrEqual(2);
      });
    } finally {
      await noJs.close();
      await withJs.close();
    }
  });
}

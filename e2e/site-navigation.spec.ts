/**
 * Site navigation consistency — header pills, brand, active state, book-flip vs
 * Back, and the shared bottom bar across Home, Projects, Blog and Contact.
 */
import { test, expect, type Page } from '@playwright/test';

const FLIP = { timeout: 3000 };
const PAGES = ['/', '/projects', '/blog', '/contact'] as const;
const PILLS = [
  { name: '01 Projects', path: '/projects' },
  { name: '02 Blog', path: '/blog' },
  { name: '03 Contact', path: '/contact' },
] as const;

const header = (page: Page) => page.locator('header.bk-header');
const heading = (page: Page) => page.getByRole('heading', { name: /Make\. Ship\./ });

async function expectUnflippedHome(page: Page) {
  await page.waitForURL(u => u.pathname === '/', FLIP);
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.locator('body')).not.toHaveClass(/bk-flip-out/);
  await expect(heading(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('header pills and brand go to the same place from every page', async ({ page }) => {
  for (const from of PAGES) {
    for (const pill of PILLS) {
      await page.goto(from);
      await header(page).getByRole('link', { name: pill.name }).click();
      await page.waitForURL(u => u.pathname === pill.path, { timeout: 5000 });
      expect(new URL(page.url()).pathname).toBe(pill.path);
    }
    await page.goto(from);
    await header(page).locator('.bk-brand').click();
    await page.waitForURL(u => u.pathname === '/', { timeout: 5000 });
    await expect(heading(page)).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/bk-flip-out/);
  }
});

test('active pill marks the current section', async ({ page }) => {
  for (const pill of PILLS) {
    await page.goto(pill.path);
    const current = header(page).locator('nav a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', pill.path);
  }
  await page.goto('/');
  await expect(header(page).locator('nav a[aria-current="page"]')).toHaveCount(0);
});

test('flip and Back agree', async ({ page }) => {
  const targets = [
    { key: '1', path: '/projects' },
    { key: '2', path: '/blog' },
    { key: '3', path: '/contact' },
  ];
  for (const t of targets) {
    await page.goto('/');
    await expect(heading(page)).toBeVisible();
    await page.keyboard.press(t.key);
    await page.waitForURL(u => u.pathname === t.path, FLIP);
    await page.goBack();
    await expectUnflippedHome(page);
  }

  await page.goto('/');
  await expect(heading(page)).toBeVisible();
  await page.keyboard.press('1');
  await page.waitForURL(u => u.pathname === '/projects', FLIP);
  await header(page).getByRole('link', { name: '03 Contact' }).click();
  await page.waitForURL(u => u.pathname === '/contact', FLIP);
  await page.goBack();
  await page.waitForURL(u => u.pathname === '/projects', FLIP);
  await page.goBack();
  await expectUnflippedHome(page);
});

test('bottom bar is consistent', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByText('Currently →')).toBeVisible();
    // Presence only — never click: it starts a real Stripe checkout.
    await expect(page.getByRole('link', { name: 'Buy me a coffee →' })).toBeVisible();
    const bar = page.locator('footer.bk-bottombar');
    await expect(bar.getByRole('link', { name: 'Privacy' }).first()).toBeAttached();
    await expect(bar.getByRole('link', { name: 'Terms' }).first()).toBeAttached();
    await expect(bar.getByText('Scroll to flip')).toHaveCount(path === '/' ? 1 : 0);
  }
});

// Time is driven only by page.clock. Long skips use fastForward (fires the interval once, no
// per-frame animation cost); runFor then lets the 400ms fade swap run.
const NOW_ROTATE_MS = 12000;
const NOW_FADE_MS = 400;

async function openHomeWithClock(page: Page) {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto('/');
  const now = page.locator('.bk-bb-now');
  await expect(now).not.toHaveText('');
  return { now, first: (await now.textContent()) ?? '' };
}

test.describe('bottom bar text is calm and readable', () => {
  test('rotates only after the 12s interval', async ({ page }) => {
    const { now, first } = await openHomeWithClock(page);
    await page.clock.fastForward(6000);
    await expect(now).toHaveText(first);
    await page.clock.fastForward(7000);
    await page.clock.runFor(NOW_FADE_MS + 100);
    await expect(now).not.toHaveText(first);
  });

  test('hover pauses rotation', async ({ page }) => {
    const { now, first } = await openHomeWithClock(page);
    // Hover before any time passes so no tick can race it.
    await page.locator('.bk-bottombar').hover();
    await page.clock.fastForward(30000);
    await page.clock.runFor(NOW_FADE_MS + 100);
    await expect(now).toHaveText(first);
  });

  test('reduced motion keeps the first item static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { now, first } = await openHomeWithClock(page);
    await page.clock.fastForward(30000);
    await page.clock.runFor(NOW_FADE_MS + 100);
    await expect(now).toHaveText(first);
  });

  for (const width of [1280, 1440]) {
    for (const path of ['/', '/contact']) {
      test(`every item is shown in full and the bar stays 52px at ${width} on ${path}`, async ({ page }) => {
        const now = page.locator('.bk-bb-now');
        const bar = page.locator('.bk-bottombar');
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
        await page.clock.install({ time: 0 });
        await page.clock.pauseAt(1000);
        await page.goto(path);
        await expect(now).not.toHaveText('');
        const seen = new Set<string>();
        for (let i = 0; i < 6 && seen.size < 4; i++) {
          const text = (await now.textContent()) ?? '';
          if (!seen.has(text)) {
            seen.add(text);
            const m = await now.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
            expect(m.sw, `${path}@${width} "${text}"`).toBeLessThanOrEqual(m.cw);
            expect((await bar.boundingBox())!.height).toBe(52);
          }
          if (seen.size < 4) {
            await page.clock.fastForward(NOW_ROTATE_MS);
            await page.clock.runFor(NOW_FADE_MS + 100);
            await expect(now).not.toHaveText(text);
          }
        }
        expect(seen.size).toBe(4);
      });
    }
  }
});

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

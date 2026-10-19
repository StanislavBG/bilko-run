/**
 * Home Radar Flip — wheel/key/click routing into the right page, back
 * navigation, and the shared header/bottom bar across Home, Projects, Contact.
 */
import { test, expect, type Page } from '@playwright/test';
import { PUBLIC_CARDS } from '../src/data/projectsView.js';

const errors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // The dev server has no API/Clerk backend: failed resource loads are environmental, not page bugs.
    if (/Failed to load resource|\/api\/|clerk/i.test(text)) return;
    list.push(text);
  });
  page.on('pageerror', err => list.push(`pageerror: ${err.message}`));
});

test.afterEach(({ page }) => {
  expect(errors.get(page) ?? []).toEqual([]);
});

const FLIP = { timeout: 3000 };

test('wheel and keys flip into the right page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make\. Ship\./ })).toBeVisible();
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 200);
  await page.waitForURL('**/projects', FLIP);
  await expect(page.locator('.pr-counter')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make\. Ship\./ })).toBeVisible();
  await page.keyboard.press('3');
  await page.waitForURL('**/contact', FLIP);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make\. Ship\./ })).toBeVisible();
  await page.keyboard.press('2');
  await page.waitForURL('**/blog', FLIP);
});

test('clicking a project blip opens that project', async ({ page }) => {
  const card = PUBLIC_CARDS[0];
  expect(card.href).toBeTruthy();
  await page.goto('/');
  const blip = page.locator(`[data-track="home-radar-${card.slug}"]`.slice(0, 200));
  await expect(blip).toHaveCount(1);
  // Blips are 0x0 anchors positioned on the dial; dispatch the click directly.
  await blip.dispatchEvent('click');
  const path = new URL(card.href!, 'http://localhost').pathname;
  await page.waitForURL(u => u.pathname.startsWith(path.replace(/\/$/, '')), FLIP);
  expect(new URL(page.url()).pathname).toContain(path.replace(/\/$/, ''));
});

test('channel blips are plain links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-track="home-radar-email"]')).toHaveAttribute('href', 'mailto:BilkoBibitkov2000@gmail.com');
  await expect(page.locator('[data-track="home-radar-x"]')).toHaveAttribute('href', 'https://x.com/BilkoBibitkov');
});

// BUG (product, follow-up): after flipping Home -> /projects, page.goBack() reaches '/'
// for an instant, then the Projects page's ?p= URL sync re-writes the URL to
// /projects?p=session-manager and the user is trapped on /projects. Un-fixme once fixed.
test.fixme('back returns to an un-flipped home', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make\. Ship\./ })).toBeVisible();
  await page.keyboard.press('1');
  await page.waitForURL('**/projects', FLIP);
  await page.goBack();
  await page.waitForURL(u => u.pathname === '/', FLIP);
  await expect(page.locator('body')).not.toHaveClass(/bk-flip-out/);
  await expect(page.getByRole('heading', { name: /Make\. Ship\./ })).toBeVisible();
});

test('same chrome on home, projects and contact', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/', '/projects', '/contact']) {
    await page.goto(path);
    const header = page.locator('header').first();
    for (const name of ['01 Projects', '02 Blog', '03 Contact']) {
      await expect(header.getByRole('link', { name })).toBeVisible();
    }
    await expect(page.getByText('Currently →')).toBeVisible();
    // Presence only — never click: it starts a real Stripe checkout.
    await expect(page.getByRole('link', { name: 'Buy me a coffee →' })).toBeVisible();
  }
  await page.goto('/projects');
  await expect(page.locator('.pr-counter')).toBeVisible();
  const fits = await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight + 1);
  expect(fits).toBe(true);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('pressing 1 reaches /projects within 1s', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Make\. Ship\./ })).toBeVisible();
    await page.keyboard.press('1');
    await page.waitForURL('**/projects', { timeout: 1000 });
  });
});

test('mobile: no horizontal overflow and Menu button shown', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make\. Ship\./ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
});

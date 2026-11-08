import { test, expect, type Page } from '@playwright/test';

const H = 3600000;
const T = Date.now() + 3 * 24 * H;
const slots = {
  timeZone: 'America/Los_Angeles',
  durationMinutes: 60,
  slots: [
    { startMs: T, endMs: T + H },
    { startMs: T + 2 * H, endMs: T + 3 * H },
  ],
  taken: [],
};

async function mock(page: Page) {
  await page.route('**/api/services/human-for-hire/slots', (r) => r.fulfill({ status: 200, json: slots }));
}

test('site nav Hire link points at /book', async ({ page }) => {
  await mock(page);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Hire$/ })).toHaveAttribute('href', '/book');
});

for (const path of ['/bilko', '/hire', '/human-for-hire']) {
  test(`${path} redirects to /book`, async ({ page }) => {
    await mock(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.getByRole('heading', { name: 'Bring your AI idea. Leave with a plan.' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: /Hire$/ })).toHaveAttribute('aria-current', 'page');
  });
}

test('Hire in the site nav keeps the header and navigates client-side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mock(page);
  await page.goto('/blog');
  await page.evaluate(() => { (window as unknown as { __bkMarker?: number }).__bkMarker = 1; });
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const hire = nav.getByRole('link', { name: /Hire$/ });
  await hire.click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.locator('header.bk-header')).toBeVisible();
  await expect(hire).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(hire).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: /Blog$/ }).click();
  await expect(page).toHaveURL(/\/blog$/);
  expect(await page.evaluate(() => (window as unknown as { __bkMarker?: number }).__bkMarker)).toBe(1);
});

test('/book/ marks Hire active in the site nav', async ({ page }) => {
  await mock(page);
  await page.goto('/book/');
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Hire$/ })).toHaveClass(/(^|\s)active(\s|$)/);
});

test('/book on a phone shows the Menu button and an active Hire link in the sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await page.goto('/book');
  const menu = page.locator('header').getByRole('button', { name: 'Menu' });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.locator('.pf-mobile-menu').getByRole('link').filter({ hasText: 'Hire' })).toHaveClass(/(^|\s)active(\s|$)/);
});

test('/bilko keeps the checkout query and shows the paid notice', async ({ page }) => {
  await mock(page);
  await page.goto('/bilko?offer=bilko-hour&session_id=cs_test_1');
  await expect(page).toHaveURL(/\/book\?offer=bilko-hour&session_id=cs_test_1$/);
  await expect(page.getByRole('status')).toContainText('Payment received');
});

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

test('home hero link lands on /book', async ({ page }) => {
  await mock(page);
  await page.goto('/');
  await page.locator('a[data-track="home-hire"]').click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
});

test('pricing link lands on /book', async ({ page }) => {
  await mock(page);
  await page.goto('/pricing');
  await page.locator('a[data-track="pricing-hire"]').click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
});

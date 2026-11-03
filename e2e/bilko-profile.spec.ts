import { test, expect, type Page } from '@playwright/test';

const T = Date.UTC(2030, 0, 15, 18, 0);
const slots = { timeZone: 'America/Los_Angeles', durationMinutes: 60, slots: [{ startMs: T, endMs: T + 3600000 }] };

async function mock(page: Page, status: number, body: object) {
  await page.route('**/api/services/human-for-hire/slots', r => r.fulfill({ json: slots }));
  await page.route('**/api/services/human-for-hire/free-hour', r =>
    r.fulfill({ status, json: body }));
  await page.route('**/api/services/human-for-hire/free-hour/cancel', r => r.fulfill({ json: { cancelled: true } }));
}

test('both Book a free hour links go to /book', async ({ page }) => {
  await mock(page, 201, {});
  await page.goto('/bilko');
  const links = page.getByRole('link', { name: 'Book a free hour' });
  await expect(links).toHaveCount(2);
  for (const l of await links.all()) await expect(l).toHaveAttribute('href', '/book');
});

test('renders no inline booking form', async ({ page }) => {
  await mock(page, 201, {});
  await page.goto('/bilko');
  await expect(page.getByRole('link', { name: 'Book a free hour' }).first()).toBeVisible();
  await expect(page.locator('.fhb-slots')).toHaveCount(0);
});

test('no sideways scroll at 390x844', async ({ page }) => {
  await mock(page, 201, {});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/bilko');
  await expect(page.getByRole('link', { name: 'Book a free hour' }).first()).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(over).toBe(false);
});

test('shows a paid message after Checkout', async ({ page }) => {
  await mock(page, 201, {});
  await page.goto('/bilko?offer=bilko-hour&session_id=cs_test_1');
  await expect(page.getByRole('status')).toHaveText('Payment received. Thank you. Bilko will email you shortly to plan your hours.');
});

test('shows a cancelled message after Checkout', async ({ page }) => {
  await mock(page, 201, {});
  await page.goto('/bilko?checkout=cancel');
  await expect(page.getByRole('status')).toHaveText('Checkout cancelled. No charge.');
});

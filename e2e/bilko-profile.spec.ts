import { test, expect, type Page } from '@playwright/test';

const T = Date.UTC(2030, 0, 15, 18, 0);
const slots = { timeZone: 'America/Los_Angeles', durationMinutes: 60, slots: [{ startMs: T, endMs: T + 3600000 }] };

async function mock(page: Page, status: number, body: object) {
  await page.route('**/api/services/human-for-hire/slots', r => r.fulfill({ json: slots }));
  await page.route('**/api/services/human-for-hire/free-hour', r =>
    r.fulfill({ status, json: body }));
  await page.route('**/api/services/human-for-hire/free-hour/cancel', r => r.fulfill({ json: { cancelled: true } }));
}

async function fill(page: Page) {
  await page.goto('/bilko');
  await page.locator('.fhb-slots button').first().click();
  await page.getByLabel('Email', { exact: true }).fill('visitor@example.com');
  await page.getByRole('button', { name: 'Book my free hour' }).click();
}

test('books a free hour', async ({ page }) => {
  await mock(page, 201, {
    booking: { startMs: T, endMs: T + 3600000 }, emailed: true,
    ics: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR', cancelToken: 'tok',
  });
  await fill(page);
  await expect(page.getByText("You're booked:")).toBeVisible();
  await expect(page.getByText('visitor@example.com')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add to calendar' })).toBeVisible();
});

test('shows already_booked', async ({ page }) => {
  await mock(page, 409, { error: 'already_booked' });
  await fill(page);
  await expect(page.getByText("You've already booked your free hour")).toBeVisible();
});

test('no sideways scroll at 390x844', async ({ page }) => {
  await mock(page, 201, {});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/bilko');
  await expect(page.getByRole('button', { name: 'Book my free hour' })).toBeVisible();
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

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
  taken: [{ startMs: T + 4 * H, endMs: T + 5 * H }],
};

async function mock(page: Page, body: object = slots, status = 200) {
  await page.route('**/api/services/human-for-hire/slots', (r) => r.fulfill({ status, json: body }));
}

test('pick a time and continue', async ({ page }) => {
  await mock(page);
  await page.goto('/book');
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
  const cont = page.getByRole('button', { name: 'Continue →' });
  await expect(cont).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Choose a time to continue')).toBeVisible();
  const first = page.locator('button.bk-slot').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toContainText('✓ Selected');
  await expect(cont).toHaveAttribute('aria-disabled', 'false');
  await cont.click();
  await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
  await page.getByRole('button', { name: 'Change' }).click();
  await expect(page.getByRole('heading', { name: 'Pick a time' })).toBeVisible();
});

test('a taken slot is not clickable', async ({ page }) => {
  await mock(page);
  await page.goto('/book');
  await expect(page.locator('button.bk-slot')).toHaveCount(2);
  await expect(page.locator('.bk-slot.taken')).toHaveCount(1);
  await expect(page.locator('.bk-slot.taken')).toContainText('Taken');
});

test('switching zone changes the shown time', async ({ page }) => {
  await mock(page);
  await page.goto('/book');
  await page.getByLabel('Times in').selectOption('America/Los_Angeles');
  const la = await page.locator('button.bk-slot .bk-time').first().innerText();
  await page.getByLabel('Times in').selectOption('Europe/Berlin');
  const de = await page.locator('button.bk-slot .bk-time').first().innerText();
  expect(de).not.toBe(la);
});

test('empty and error states', async ({ page }) => {
  await mock(page, { slots: [], taken: [] });
  await page.goto('/book');
  await expect(page.getByText('No open times right now. Write to')).toBeVisible();
  await expect(page.locator('.bk-card a[href^="mailto:"]')).toBeVisible();
});

test('load error shows Retry', async ({ page }) => {
  await mock(page, { error: 'x' }, 500);
  await page.goto('/book');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

for (const [w, h] of [[1280, 720], [390, 844]] as const) {
  test(`screenshot and no sideways scroll at ${w}x${h}`, async ({ page }) => {
    await mock(page);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/book');
    await expect(page.locator('button.bk-slot').first()).toBeVisible();
    await page.locator('button.bk-slot').first().click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(over).toBe(false);
    await page.screenshot({ path: `test-results/booking-page-${w}x${h}.png`, fullPage: true });
  });
}

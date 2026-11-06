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
    await expect(page.getByRole('link', { name: /Hire$/ })).toHaveCount(0);
  });
}

test('/bilko keeps the checkout query and shows the paid notice', async ({ page }) => {
  await mock(page);
  await page.goto('/bilko?offer=bilko-hour&session_id=cs_test_1');
  await expect(page).toHaveURL(/\/book\?offer=bilko-hour&session_id=cs_test_1$/);
  await expect(page.getByRole('status')).toContainText('Payment received');
});

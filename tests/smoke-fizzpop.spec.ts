import { test, expect } from '@playwright/test';

test.describe('FizzPop production smoke', () => {
  test.use({ baseURL: 'https://bilko.run' });

  test('live URL serves FizzPop chrome', async ({ page }) => {
    const resp = await page.goto('/projects/fizzpop/');
    expect(resp?.status()).toBe(200);
    await expect(page).toHaveTitle(/FizzPop/i);
  });

  test('mode-select cards render', async ({ page }) => {
    await page.goto('/projects/fizzpop/');
    await expect(page.locator('.fp-mode-card').filter({ hasText: 'Beginner' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.fp-mode-card').filter({ hasText: 'Daily' })).toBeVisible();
  });

  test('Daily Solvable badge present', async ({ page }) => {
    await page.goto('/projects/fizzpop/');
    await expect(page.locator('.fp-daily-pledge')).toContainText(/daily solvable/i, { timeout: 10000 });
  });

  test('bubble color CSS token loaded', async ({ page }) => {
    await page.goto('/projects/fizzpop/');
    const color = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bubble-1').trim(),
    );
    expect(color.length).toBeGreaterThan(0);
  });
});

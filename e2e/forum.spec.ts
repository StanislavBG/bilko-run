import { test, expect } from '@playwright/test';

test('forum index renders live data', async ({ page }) => {
  await page.goto('/forum');
  await expect(page.getByRole('heading', { name: 'Forum.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'I WAS HERE!' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /What brought you/ })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Session Manager — setups, questions, field notes/ }),
  ).toBeVisible();
});

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

test('thread page reads signed out', async ({ page }) => {
  await page.goto('/forum/t/sm');
  await expect(page.getByRole('heading', { name: /Session Manager — setups, questions, field notes/ })).toBeVisible();
  await expect(page.getByText('Host', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('@bilko').first()).toBeVisible();
  await expect(page.getByText('Sign in to reply.')).toBeVisible();

  await page.goto('/forum/t/brought');
  await expect(page.getByRole('heading', { name: /What brought you/ })).toBeVisible();
});

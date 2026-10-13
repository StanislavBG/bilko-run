/**
 * /projects — each collapsed row exposes an Open button; clicking the rest of
 * the row still expands the details drawer.
 */
import { test, expect } from '@playwright/test';
import { PUBLIC_CARDS } from '../src/data/projectsView.js';

test('first row opens in one click without expanding', async ({ page }) => {
  const card = PUBLIC_CARDS[0];
  expect(card.href).toBeTruthy();

  await page.goto('/projects');
  const row = page.locator('.pf-hub-row').first();
  const toggle = row.locator('.pf-hub-head');
  const open = row.locator('.pf-hub-open');

  await expect(open).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.hover();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(row.locator('.pf-hub-primary')).toHaveCount(0);
  await expect(page.locator('.pf-hub-meta')).toHaveCount(0);

  await open.click();
  await page.waitForURL(url => url.toString().includes(card.href!));
  expect(page.url()).toContain(card.href!);
});

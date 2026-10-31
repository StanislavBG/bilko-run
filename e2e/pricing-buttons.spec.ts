import { test, expect } from '@playwright/test';

// An unlayered .portfolio-shell button reset once beat every Tailwind utility here.
test('pricing buttons keep their utility fill and padding', async ({ page }) => {
  await page.goto('/pricing');
  const add = page.getByRole('button', { name: 'Add $3', exact: true });
  const order = page.getByRole('button', { name: 'Order' }).first();
  await expect(add).toBeVisible();
  await expect(order).toBeVisible();
  const style = (l: typeof add, p: string) =>
    l.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), p);
  expect(await style(add, 'background-color')).not.toBe('rgba(0, 0, 0, 0)');
  expect(await style(order, 'background-color')).not.toBe('rgba(0, 0, 0, 0)');
  expect(parseFloat(await style(add, 'padding-left'))).toBeGreaterThan(0);
});

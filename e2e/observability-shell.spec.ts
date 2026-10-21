/**
 * /admin/observability/preview — the RECENT HITS bar stays inside the viewport
 * (28px tall) at laptop-sized viewports, in every layout.
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 650 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const LAYOUTS = ['RAILS', 'DOCK', 'WING'] as const;

for (const vp of VIEWPORTS) {
  test(`RECENT HITS bar fits at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('/admin/observability/preview');

    for (const layout of LAYOUTS) {
      await page.getByRole('button', { name: layout, exact: true }).click();
      const label = page.getByText('RECENT HITS', { exact: true });
      await expect(label).toBeVisible();
      const bar = await label.evaluate(el => {
        const r = el.parentElement!.getBoundingClientRect();
        return { bottom: r.bottom, height: r.height, innerHeight: window.innerHeight };
      });
      expect(bar.bottom, `${layout} bottom`).toBeLessThanOrEqual(bar.innerHeight);
      expect(bar.height, `${layout} height`).toBe(28);
    }
  });
}

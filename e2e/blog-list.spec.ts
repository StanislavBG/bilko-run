/**
 * /blog — the Video badge stays on one line and stacks under the category label.
 */
import { test, expect } from '@playwright/test';

const post = (slug: string, extra: Record<string, unknown> = {}) => ({
  id: slug,
  title: `Post ${slug}`,
  slug,
  excerpt: 'A short excerpt for the read-time estimate.',
  category: 'product',
  published_at: '2026-10-01T00:00:00Z',
  ...extra,
});

test('video badge is a single line stacked under the category', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route('**/api/blog', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        post('with-video', { video_url: '/blog-videos/x/' }),
        post('no-video'),
      ]),
    }),
  );

  await page.goto('/blog');
  const rows = page.locator('.pf-post-row');
  await expect(rows).toHaveCount(2);

  const badge = rows.nth(0).locator('.pf-video-badge');
  await expect(badge).toHaveText('▶ Video');
  const box = await badge.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThan(20);

  const tagBox = await rows.nth(0).locator('.pf-tag').boundingBox();
  const labelBottom = await rows.nth(0).locator('.pf-tag').evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el.firstChild!);
    return range.getBoundingClientRect().bottom;
  });
  expect(tagBox).not.toBeNull();
  expect(box!.y).toBeGreaterThan(labelBottom - 1);

  await expect(rows.nth(1).locator('.pf-video-badge')).toHaveCount(0);
});

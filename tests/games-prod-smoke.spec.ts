import { test, expect } from '@playwright/test';

const BASE = 'https://bilko.run';

const GAMES = [
  { slug: 'fizzpop',    titleRe: /fizzpop/i,     rootSelector: 'canvas, .fp-canvas, [role="application"], .fp-mode-card' },
  { slug: 'etch',       titleRe: /etch/i,        rootSelector: '[role="gridcell"], .etch-cell, .etch-grid' },
  { slug: 'cellar',     titleRe: /cellar/i,      rootSelector: '.cellar-cascade, .cellar-board, [data-cellar="board"]' },
  // Regression spot-checks
  { slug: 'sudoku',     titleRe: /sudoku/i,      rootSelector: '.sudoku-cell, [data-sudoku="cell"], [role="gridcell"]', regression: true },
  { slug: 'mindswiffer', titleRe: /mindswiffer|sweeper/i, rootSelector: '.ms-cell, [data-mindswiffer="cell"]', regression: true },
  { slug: 'academy',    titleRe: /academy/i,     rootSelector: 'h1, [role="main"]', regression: true },
];

for (const g of GAMES) {
  test(`prod ${g.slug}: index html serves the game (not SPA fallback)`, async ({ request }) => {
    const res = await request.get(`${BASE}/projects/${g.slug}/`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    const title = body.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
    expect(title, `Got fallback title "${title}" for ${g.slug}`).toMatch(g.titleRe);
    expect(title, `${g.slug} returned host SPA fallback title`).not.toMatch(/AI Advisory for Small Business/i);
  });

  if (!g.regression) {
    test(`prod ${g.slug}: manifest.json valid`, async ({ request }) => {
      const res = await request.get(`${BASE}/projects/${g.slug}/manifest.json`);
      expect(res.status()).toBe(200);
      const m = await res.json();
      expect(m.slug).toBe(g.slug);
    });
  }

  test(`prod ${g.slug}: page loads, game root visible, no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${BASE}/projects/${g.slug}/`);
    await expect(page.locator(g.rootSelector).first()).toBeVisible({ timeout: 12000 });
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('favicon') && !e.includes('ERR_BLOCKED') && !e.includes('net::'))).toEqual([]);
  });
}

test('studio page lists all 3 new games', async ({ page }) => {
  await page.goto(`${BASE}/studio`);
  for (const slug of ['fizzpop', 'etch', 'cellar', 'sudoku', 'mindswiffer']) {
    const cardRe = new RegExp(slug.replace(/-/g, '[\\s-]?'), 'i');
    await expect(page.locator('body')).toContainText(cardRe);
  }
});

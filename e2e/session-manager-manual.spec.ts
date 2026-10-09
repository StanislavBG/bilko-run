/**
 * /products/session-manager/manual — page 3 of the landing book.
 *
 * Runs against `pnpm dev` (Vite :3002 + API :4000) via playwright.config.ts.
 * The TOC and chapters are served from the newest local release bundle so the
 * chapter list is deterministic whatever the API is doing.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { COPY } from '../src/pages/session-manager-landing/copy.js';

const LANDING = '/products/session-manager';
const MANUAL = `${LANDING}/manual`;
const HERE = dirname(fileURLToPath(import.meta.url));
const RELEASES = resolve(HERE, '..', 'data', 'manual', 'releases');

function latestRelease() {
  const versions = readdirSync(RELEASES).filter(v => /^\d+\.\d+\.\d+$/.test(v));
  versions.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  });
  const dir = resolve(RELEASES, versions[versions.length - 1]);
  return { dir, manifest: JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf-8')) };
}

type Chapter = { slug: string; title: string; blurb: string; part?: string; free?: boolean; file?: string };

function latestToc() {
  const { manifest } = latestRelease();
  return {
    free: true,
    toc: {
      version: manifest.version,
      releasedAt: manifest.releasedAt,
      title: manifest.title,
      summary: manifest.summary,
      documentsAppVersion: manifest.documentsAppVersion,
      chapters: manifest.chapters.map((c: Chapter) => ({
        slug: c.slug,
        title: c.title,
        blurb: c.blurb,
        part: c.part,
        free: !!c.free,
      })),
      assets: [],
    },
  };
}

/** Stub the TOC and every chapter request; chapter bodies are a small deterministic stand-in. */
async function stub(page: Page) {
  const toc = latestToc();
  await page.route('**/api/manual/toc', route => route.fulfill({ json: toc }));
  await page.route('**/api/manual/chapter/*', route => {
    const slug = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
    const c = toc.toc.chapters.find((x: Chapter) => x.slug === slug);
    if (!c) return route.fulfill({ status: 404, json: { error: 'not found' } });
    return route.fulfill({
      json: { slug: c.slug, title: c.title, blurb: c.blurb, free: true, html: `<h2>${c.title}</h2><p>Body of ${c.slug}.</p>` },
    });
  });
  return toc;
}

async function openManual(page: Page, hash = '') {
  const toc = await stub(page);
  await page.goto(`${MANUAL}${hash}`);
  await expect(page.locator('.smlm-card')).toBeVisible();
  return toc;
}

async function openParts(page: Page) {
  const toc = await stub(page);
  await page.goto(`${LANDING}#parts`);
  await expect(page.getByRole('tablist')).toBeVisible();
  return toc;
}

async function noHorizontalScroll(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test.describe('Session Manager manual — book page 3 (1440x860)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
  });

  test('renders the landing header and no Bilko site chrome', async ({ page }) => {
    await openManual(page);
    await expect(page.locator('.smlp-header')).toBeVisible();
    await expect(page.locator('.pf-topbar')).toHaveCount(0);
    await expect(page.locator('.smlm-rail')).toBeVisible();
    await expect(page.locator('.smlp-dot')).toHaveCount(3);
    await expect(page.locator('.smlp-dot--on')).toHaveAttribute('aria-current', 'page');
  });

  test('the header stays pinned to the top after scrolling the window', async ({ page }) => {
    await openManual(page);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const box = await page.locator('.smlp-header').boundingBox();
    expect(box!.y).toBe(0);
  });

  test('the wheel on page 2 turns to the manual at the selected tab\'s chapter', async ({ page }) => {
    await openParts(page);
    const tab = COPY.tabs[1];
    await page.getByRole('tab', { name: tab.label }).click();
    await expect(page.getByRole('tab', { name: tab.label })).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(800); // the turn lock from landing on page 2
    await page.mouse.move(720, 430);
    await page.mouse.wheel(0, 200);
    await expect(page).toHaveURL(new RegExp(`${MANUAL}#${tab.chapter.slug}$`));
    await expect(page.locator('.smlm-card')).toBeVisible();
    await expect(page.locator('.smlm-rail__row[aria-current="page"]')).toBeVisible();
  });

  test('PageDown on page 2 turns to the manual at the selected tab\'s chapter', async ({ page }) => {
    await openParts(page);
    const tab = COPY.tabs[2];
    await page.getByRole('tab', { name: tab.label }).click();
    await expect(page.getByRole('tab', { name: tab.label })).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(800);
    // Focus off the tablist, so the key is the page's, not the tab's.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('PageDown');
    await expect(page).toHaveURL(new RegExp(`${MANUAL}#${tab.chapter.slug}$`));
    await expect(page.locator('.smlm-card')).toBeVisible();
  });

  test('the chapter card link reaches its chapter', async ({ page }) => {
    await openParts(page);
    const tab = COPY.tabs[1];
    await page.getByRole('tab', { name: tab.label }).click();
    await page.locator('.smlp-chapter__link').click();
    await expect(page).toHaveURL(new RegExp(`${MANUAL}#${tab.chapter.slug}$`));
    await expect(page.locator('.smlm-card')).toBeVisible();
    await expect(page.locator('.smlp-header')).toBeVisible();
  });

  test('ctrl-click on the chapter card link is not intercepted', async ({ page }) => {
    await openParts(page);
    await page.evaluate(() => { (window as any).__stay = true; });
    const [popup] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 5_000 }).catch(() => null),
      page.locator('.smlp-chapter__link').click({ modifiers: ['Control'] }),
    ]);
    await popup?.close();
    // No client navigation in this page: same URL, same document, parts bin still showing.
    await expect(page).toHaveURL(/#parts$/);
    expect(await page.evaluate(() => (window as any).__stay)).toBe(true);
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('the back row and dot 2 return to the landing on page 2', async ({ page }) => {
    await openManual(page);
    await page.getByRole('button', { name: COPY.book.toParts }).click();
    await expect(page).toHaveURL(/\/products\/session-manager#parts$/);
    await expect(page.getByRole('tablist')).toBeVisible();

    await page.goBack();
    await expect(page.locator('.smlm-card')).toBeVisible();
    await page.getByRole('link', { name: /^Go to page 2 of/ }).click();
    await expect(page).toHaveURL(/\/products\/session-manager#parts$/);
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(page.locator('.smlp-dot--on')).toHaveAttribute('aria-label', /^Go to page 2 of/);
  });

  test('the rail and the next button switch chapters and update the hash', async ({ page }) => {
    const toc = await openManual(page);
    const [first, second, third] = toc.toc.chapters as Chapter[];
    await expect(page.locator('.smlm-rail__row[aria-current="page"] .smlm-rail__label')).toHaveText(first.title);

    await page.locator('.smlm-rail__row', { hasText: second.title }).first().click();
    await expect(page).toHaveURL(new RegExp(`#${second.slug}$`));
    await expect(page.locator('.smlm-prose')).toContainText(`Body of ${second.slug}`);
    await expect(page.locator('.smlm-rail__row[aria-current="page"] .smlm-rail__label')).toHaveText(second.title);

    await page.locator('.smlm-pager__next').click();
    await expect(page).toHaveURL(new RegExp(`#${third.slug}$`));
    await expect(page.locator('.smlm-prose')).toContainText(`Body of ${third.slug}`);
    await expect(page.locator('.smlm-rail__row[aria-current="page"] .smlm-rail__label')).toHaveText(third.title);
  });
});

test.describe('Session Manager manual — reflow (390x844)', () => {
  test('is a single column with no dots and no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openManual(page);
    await expect(page.locator('.smlp-header')).toBeVisible();
    await expect(page.locator('.pf-topbar')).toHaveCount(0);
    await expect(page.locator('.smlp-dot')).toHaveCount(0);
    await expect(page.locator('.smlm-rail')).toHaveCount(0);
    await expect(page.locator('.smlm-picker__select')).toBeVisible();
    const [railLeft, cardLeft] = await page.evaluate(() => {
      const spread = document.querySelector('.smlm-spread')!;
      const kids = [...spread.children].map(el => el.getBoundingClientRect().left);
      return [kids[0], kids[kids.length - 1]];
    });
    expect(Math.abs(railLeft - cardLeft)).toBeLessThan(2);
    await noHorizontalScroll(page);
  });
});

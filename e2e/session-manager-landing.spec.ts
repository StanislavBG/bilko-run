/**
 * /products/session-manager — the Session Manager landing page (v2).
 *
 * Runs against `pnpm dev` (Vite :3002 + API :4000) via playwright.config.ts.
 * The TOC is served from the newest local release bundle so the chapter count
 * and links are deterministic whatever the API is doing.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { COPY } from '../src/pages/session-manager-landing/copy.js';

const PATH = '/products/session-manager';
const HERE = dirname(fileURLToPath(import.meta.url));
const RELEASES = resolve(HERE, '..', 'data', 'manual', 'releases');

function latestToc() {
  const versions = readdirSync(RELEASES).filter(v => /^\d+\.\d+\.\d+$/.test(v));
  versions.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  });
  const manifest = JSON.parse(readFileSync(resolve(RELEASES, versions[versions.length - 1], 'manifest.json'), 'utf-8'));
  return {
    free: true,
    toc: {
      version: manifest.version,
      releasedAt: manifest.releasedAt,
      title: manifest.title,
      summary: manifest.summary,
      documentsAppVersion: manifest.documentsAppVersion,
      chapters: manifest.chapters.map((c: { slug: string; title: string; blurb: string; free?: boolean }) => ({
        slug: c.slug,
        title: c.title,
        blurb: c.blurb,
        free: !!c.free,
      })),
      assets: [],
    },
  };
}

async function open(page: Page) {
  const toc = latestToc();
  await page.route('**/api/manual/toc', route => route.fulfill({ json: toc }));
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(COPY.hero.headlineLine2);
  return toc;
}

async function noHorizontalScroll(page: Page) {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test.describe('Session Manager landing — layout modes', () => {
  test('canvas mode at 1440x860 reproduces the fixed design canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    const toc = await open(page);

    const root = page.locator('.smlp-root');
    await expect(root).toHaveAttribute('data-layout', 'canvas');
    await expect(page.locator('.smlp-canvas')).toHaveCSS('width', '1440px');
    await expect(page.locator('.smlp-canvas')).toHaveCSS('height', '860px');
    await expect(page.locator('.smlp-stripe')).toHaveCount(2);
    await expect(page.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    // The in-h1 audience pill is aria-hidden: the heading's name is the headline alone.
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/^Claude Code,\s*supercharged\.$/);
    // Body overflow is locked only while the canvas is mounted.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    // Truthful copy: free app, macOS + Linux, live chapter count.
    const tag = page.getByRole('region', { name: COPY.priceTag.aria.region });
    await expect(tag).toContainText(COPY.priceTag.price);
    await expect(tag).toContainText(COPY.priceTag.line);
    await expect(tag).toContainText(COPY.priceTag.platforms);
    await expect(tag).not.toContainText('WINDOWS');
    await expect(page.locator('.smlp-cta--manual')).toContainText(`${toc.toc.chapters.length} chapters of tips & tricks`);
    await expect(page.locator('.smlp-cta--manual')).toHaveAttribute('href', COPY.meta.manualHref);

    await noHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/session-manager-landing-1440x860.png' });

    // Leaving the page (a client-side navigation, so the component really
    // unmounts in the same document) restores the body's overflow.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/projects');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.locator('.smlp-root')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    expect(await page.evaluate(() => !!document.getElementById('smlp-fonts'))).toBe(false);
  });

  test('reflow mode at 390x844 is a scrollable single column', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);

    await expect(page.locator('.smlp-root')).toHaveAttribute('data-layout', 'reflow');
    await expect(page.locator('.smlp-stripe')).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    // The install command and its button are reachable on a phone.
    await page.locator('.smlp-tag__copy').scrollIntoViewIfNeeded();
    await expect(page.locator('.smlp-tag__copy')).toBeVisible();
    await expect(page.locator('.smlp-cmd code').first()).toHaveText(COPY.meta.installCommand);

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(pageHeight).toBeGreaterThan(844);
    await noHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/session-manager-landing-390x844.png', fullPage: true });
  });

  for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 640 }, { width: 844, height: 390 }]) {
    test(`reflow header lines up with the content column (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      await expect(page.locator('.smlp-root')).toHaveAttribute('data-layout', 'reflow');
      const { logoLeft, manualRight, colLeft, colRight } = await page.evaluate(() => {
        const main = document.querySelector('.smlp-main')!;
        const cs = getComputedStyle(main);
        const m = main.getBoundingClientRect();
        return {
          // The S tile is rotated -6deg, so its box pokes ~1.4px past its edge.
          logoLeft: document.querySelector('.smlp-logo')!.getBoundingClientRect().left,
          manualRight: document.querySelector('.smlp-header__manual')!.getBoundingClientRect().right,
          colLeft: m.left + parseFloat(cs.paddingLeft),
          colRight: m.right - parseFloat(cs.paddingRight),
        };
      });
      expect(Math.abs(logoLeft - colLeft)).toBeLessThan(3);
      // Signed out with Clerk unreachable, the manual link is the last item.
      expect(manualRight).toBeLessThanOrEqual(colRight + 0.5);
      expect(colRight - manualRight).toBeLessThan(100);
    });
  }

  test('resizing switches modes live', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    await open(page);
    await expect(page.locator('.smlp-root')).toHaveAttribute('data-layout', 'canvas');
    await page.setViewportSize({ width: 1280, height: 640 });
    await expect(page.locator('.smlp-root')).toHaveAttribute('data-layout', 'reflow');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    await page.setViewportSize({ width: 1440, height: 860 });
    await expect(page.locator('.smlp-root')).toHaveAttribute('data-layout', 'canvas');
  });
});

test.describe('Session Manager landing — Parts Bin', () => {
  for (const viewport of [{ width: 1440, height: 860 }, { width: 390, height: 844 }]) {
    test(`tab switching updates the panel and the chapter link (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      const panel = page.getByRole('tabpanel');
      const link = page.locator('.smlp-chapter__link');

      const first = COPY.tabs[0];
      await expect(page.getByRole('tab', { selected: true })).toContainText(first.label);
      await expect(panel.getByRole('heading', { level: 3 })).toHaveText(first.title);
      await expect(link).toHaveAttribute('href', `${COPY.meta.manualHref}#${first.chapter.slug}`);

      // Click.
      const scheduler = COPY.tabs[1];
      await page.getByRole('tab', { name: scheduler.label }).click();
      await expect(page.getByRole('tab', { name: scheduler.label })).toHaveAttribute('aria-selected', 'true');
      await expect(panel.getByRole('heading', { level: 3 })).toHaveText(scheduler.title);
      await expect(panel).toContainText('PART 02 · SCHEDULER');
      await expect(link).toHaveAttribute('href', `${COPY.meta.manualHref}#${scheduler.chapter.slug}`);
      await expect(page.locator('.smlp-chapter')).toContainText(scheduler.chapter.title);

      // Keyboard: arrows move focus + selection, wrap, Home/End.
      await page.getByRole('tab', { name: scheduler.label }).focus();
      await page.keyboard.press('ArrowDown');
      const agents = COPY.tabs[2];
      await expect(page.getByRole('tab', { name: agents.label })).toBeFocused();
      await expect(panel.getByRole('heading', { level: 3 })).toHaveText(agents.title);
      await page.keyboard.press('End');
      const kit = COPY.tabs[8];
      await expect(page.getByRole('tab', { name: kit.label })).toHaveAttribute('aria-selected', 'true');
      await expect(link).toHaveAttribute('href', `${COPY.meta.manualHref}#${kit.chapter.slug}`);
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tab', { name: first.label })).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowUp');
      await expect(page.getByRole('tab', { name: kit.label })).toBeFocused();

      // Roving tabindex: exactly one tab is in the Tab order.
      await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
      await noHorizontalScroll(page);
    });
  }

  // From 600px the reflow column is wide enough that the row wraps: as a
  // scroller it hid tabs 07-09 inside the fade at every width from 752px up.
  for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 640 }, { width: 844, height: 390 }, { width: 600, height: 900 }]) {
    test(`a wide reflow column shows all nine tabs (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      await expect(page.locator('.smlp-root')).toHaveAttribute('data-layout', 'reflow');
      const { outside, overflows } = await page.evaluate(() => {
        const list = document.querySelector('.smlp-bin__tablist')!;
        const r = list.getBoundingClientRect();
        const outside = [...list.querySelectorAll('.smlp-tab')]
          .filter(t => { const b = t.getBoundingClientRect(); return b.left < r.left - 0.5 || b.right > r.right + 0.5; })
          .map(t => t.textContent);
        return { outside, overflows: list.scrollWidth > list.clientWidth };
      });
      expect(outside).toEqual([]);
      expect(overflows).toBe(false);
      await expect(page.locator('.smlp-bin__rail')).not.toHaveAttribute('data-more', /.*/);
      await page.getByRole('tablist').scrollIntoViewIfNeeded();
      for (const t of COPY.tabs) await expect(page.getByRole('tab', { name: t.label })).toBeInViewport({ ratio: 1 });
    });
  }

  // Below 600px the row scrolls. The fade alone is no cue where a tab
  // boundary lands at its start (450, 568/570), so a chevron shows while any
  // tab lies past the right edge, and goes once the row is scrolled to its end.
  for (const viewport of [{ width: 390, height: 844 }, { width: 450, height: 800 }, { width: 568, height: 320 }]) {
    test(`a narrow reflow row cues the tabs past its edge (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      const rail = page.locator('.smlp-bin__rail');
      await expect(rail).toHaveAttribute('data-more', 'true');
      await expect.poll(() => rail.evaluate(el => getComputedStyle(el, '::after').opacity)).toBe('1');
      await page.locator('.smlp-bin__tablist').evaluate(el => { el.scrollLeft = el.scrollWidth; });
      await expect(rail).not.toHaveAttribute('data-more', /.*/);
      await expect.poll(() => rail.evaluate(el => getComputedStyle(el, '::after').opacity)).toBe('0');
      await page.locator('.smlp-bin__tablist').evaluate(el => { el.scrollLeft = 0; });
      await expect(rail).toHaveAttribute('data-more', 'true');
    });
  }
});

test.describe('Session Manager landing — film', () => {
  for (const viewport of [{ width: 1440, height: 860 }, { width: 390, height: 844 }]) {
    test(`the film dialog opens over the viewport and closes with Escape (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      const trigger = page.getByRole('button', { name: new RegExp(COPY.ctas.film.title) });
      await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      // The closed dialog downloads nothing: no src or poster until it first opens.
      await expect(page.locator('dialog.smlp-film video')).not.toHaveAttribute('src', /./);
      await expect(page.locator('dialog.smlp-film video')).not.toHaveAttribute('poster', /./);
      await trigger.click();

      const dialog = page.getByRole('dialog', { name: COPY.film.aria.dialog });
      await expect(dialog).toBeVisible();
      // Portalled onto <body>, not inside the scaled canvas.
      expect(await page.evaluate(() => document.querySelector('dialog.smlp-film')?.parentElement === document.body)).toBe(true);
      expect(await page.evaluate(() => !!document.querySelector('.smlp-canvas dialog'))).toBe(false);
      // It covers the real viewport.
      const box = await dialog.boundingBox();
      expect(box?.width).toBeCloseTo(viewport.width, 0);
      expect(box?.height).toBeCloseTo(viewport.height, 0);

      // The custom controls drive a real <video>.
      const video = dialog.locator('video');
      await expect(video).toHaveAttribute('src', COPY.film.src);
      await expect(dialog.getByRole('slider', { name: COPY.film.aria.seek })).toBeVisible();
      const play = dialog.getByRole('button', { name: new RegExp(`^(${COPY.film.aria.play}|${COPY.film.aria.pause})$`) });
      await expect(play).toBeFocused();
      await dialog.getByRole('button', { name: /Playback speed/ }).click();
      expect(await video.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1.5);
      await dialog.getByRole('button', { name: COPY.film.soundOn }).click();
      expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
      await expect(dialog.getByRole('button', { name: COPY.film.soundOff })).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(await page.locator('dialog.smlp-film video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    });
  }

  for (const viewport of [{ width: 1440, height: 860 }, { width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
    test(`the canvas film panel sits where the mock puts it (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page);
      await page.getByRole('button', { name: new RegExp(COPY.ctas.film.title) }).click();
      await expect(page.getByRole('dialog', { name: COPY.film.aria.dialog })).toBeVisible();
      const { panel, expected } = await page.evaluate(() => {
        const s = Math.min(innerWidth / 1440, innerHeight / 860);
        const offX = Math.max(0, (innerWidth - 1440 * s) / 2);
        const offY = Math.max(0, (innerHeight - 860 * s) / 2);
        const b = document.querySelector('.smlp-film__panel')!.getBoundingClientRect();
        // V2:137: left 200, top 52, width 1040 on the 1440x860 canvas.
        return { panel: [b.left, b.top, b.width], expected: [offX + 200 * s, offY + 52 * s, 1040 * s] };
      });
      for (let i = 0; i < 3; i++) expect(Math.abs(panel[i] - expected[i])).toBeLessThan(1);
    });
  }

  test('a seek drag that loses pointer capture never freezes the time readout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    await open(page);
    await page.getByRole('button', { name: new RegExp(COPY.ctas.film.title) }).click();
    const dialog = page.getByRole('dialog', { name: COPY.film.aria.dialog });
    await expect(dialog).toBeVisible();
    await dialog.locator('video').evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play().catch(() => {});
    });
    const slider = dialog.getByRole('slider', { name: COPY.film.aria.seek });
    await slider.evaluate(el => el.addEventListener('pointerdown', e => { (window as any).__pid = (e as PointerEvent).pointerId; }));

    // Press on the track and drag a little (the capture takes effect on that
    // move), then lose the capture without a pointerup reaching the track, as
    // when the dialog closes or the tab hides mid-drag, and release over the
    // title instead.
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.12, box.y + box.height / 2);
    await slider.evaluate(el => el.releasePointerCapture((window as any).__pid));
    const title = (await dialog.locator('.smlp-film__title').boundingBox())!;
    await page.mouse.move(title.x + 10, title.y + title.height / 2);
    await page.mouse.up();

    // The film keeps playing, and the knob and readout keep following it.
    const seekedTo = Number(await slider.getAttribute('aria-valuenow'));
    await expect.poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 10_000 }).toBeGreaterThanOrEqual(seekedTo + 2);
    await dialog.getByRole('button', { name: COPY.film.aria.close }).click();
  });

  test('the close button and the end card work', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 860 });
    await open(page);
    await page.getByRole('button', { name: new RegExp(COPY.ctas.film.title) }).click();
    const dialog = page.getByRole('dialog', { name: COPY.film.aria.dialog });
    await expect(dialog).toBeVisible();

    const video = dialog.locator('video');
    await video.evaluate(async (v: HTMLVideoElement) => {
      if (!Number.isFinite(v.duration)) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
      v.muted = true;
      v.currentTime = v.duration - 0.2;
      await v.play().catch(() => {});
    });
    await expect(dialog.getByText(COPY.endCard.headline)).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('link', { name: COPY.endCard.manualCta })).toHaveAttribute('href', COPY.endCard.manualHref);
    await dialog.getByRole('button', { name: COPY.endCard.replay }).click();
    await expect(dialog.getByText(COPY.endCard.headline)).toBeHidden();

    await dialog.getByRole('button', { name: COPY.film.aria.close }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('Session Manager landing — copy button', () => {
  test('shows "Copied" only after the clipboard write resolves', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1440, height: 860 });
    await open(page);

    const button = page.locator('.smlp-tag__copy');
    await expect(button).toHaveAccessibleName(COPY.priceTag.copyLabel);
    const before = await button.evaluate(el => (el as HTMLElement).offsetHeight);
    await button.click();
    await expect(button).toHaveAttribute('data-state', 'copied');
    await expect(button).toHaveAccessibleName(COPY.priceTag.copiedLabel);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(COPY.meta.installCommand);
    await expect(page.locator('.smlp-root > [role="status"]')).toHaveText(COPY.priceTag.aria.copiedStatus);
    // No layout jump when the label changes.
    expect(await button.evaluate(el => (el as HTMLElement).offsetHeight)).toBe(before);
    await expect(button).toHaveAttribute('data-state', 'copy', { timeout: 5_000 });
  });

  test('when the clipboard refuses, it selects the command and says so', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')), readText: () => Promise.reject(new Error('denied')) },
      });
      document.execCommand = () => false;
    });
    await page.setViewportSize({ width: 1440, height: 860 });
    await open(page);

    const button = page.locator('.smlp-tag__copy');
    await button.click();
    await expect(button).toHaveAttribute('data-state', 'failed');
    await expect(button).toHaveAccessibleName(COPY.priceTag.copyFailedLabel);
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(COPY.meta.installCommand);
    await expect(page.locator('.smlp-root > [role="status"]')).toHaveText(COPY.priceTag.aria.copyFailedStatus);
  });
});

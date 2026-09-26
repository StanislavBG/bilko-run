/**
 * Data + pure-logic guards for the Session Manager landing page
 * (src/pages/SessionManagerPage.tsx and src/pages/session-manager-landing/).
 *
 * The chapter checks are the important ones: each Parts Bin tab deep-links to
 * /products/session-manager/manual#<slug>, and the reader silently opens
 * chapter 1 for a slug it doesn't know. So every slug must exist in the NEWEST
 * release bundle, with the same title — a manual release that renames or drops
 * a chapter fails here and forces a copy review instead of shipping a link
 * that quietly lands somewhere else.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { latestManualVersion, isValidManualVersion, type ManualManifest, type ManualToc } from '../shared/manual-catalog.js';
import { COPY, fill } from '../src/pages/session-manager-landing/copy.js';
import { TABS, chapterHref } from '../src/pages/session-manager-landing/PartsBin.js';
import { filmPanelCanvasStyle, formatTime, layoutMode, nextTabIndex, partNumber } from '../src/pages/session-manager-landing/layout.js';

const RELEASES = resolve(__dirname, '..', 'data', 'manual', 'releases');

function latestManifest(): ManualManifest {
  const versions = readdirSync(RELEASES).filter(isValidManualVersion);
  const latest = latestManualVersion(versions);
  if (!latest) throw new Error('no manual release bundles under data/manual/releases');
  return JSON.parse(readFileSync(resolve(RELEASES, latest, 'manifest.json'), 'utf-8')) as ManualManifest;
}

describe('Parts Bin tab data', () => {
  it('is the copy file’s nine tabs, in order', () => {
    expect(TABS).toBe(COPY.tabs);
    expect(TABS).toHaveLength(9);
    expect(TABS.map(t => t.key)).toEqual([
      'sessions', 'scheduler', 'agents', 'tags', 'memory', 'history', 'config', 'voice', 'kit',
    ]);
  });

  it('has unique keys, three bullets and three points per tab, and no empty strings', () => {
    expect(new Set(TABS.map(t => t.key)).size).toBe(TABS.length);
    for (const t of TABS) {
      expect(t.bullets, `${t.key} bullets`).toHaveLength(3);
      expect(t.chapter.points, `${t.key} points`).toHaveLength(3);
      for (const s of [t.label, t.title, t.body, t.chapter.slug, t.chapter.title, ...t.bullets, ...t.chapter.points]) {
        expect(s.trim(), `${t.key} has an empty string`).not.toBe('');
      }
    }
  });

  it('every chapter slug exists in the newest manual release, with the same title', () => {
    const manifest = latestManifest();
    const bySlug = new Map(manifest.chapters.map(c => [c.slug, c]));
    for (const t of TABS) {
      const chapter = bySlug.get(t.chapter.slug);
      expect(chapter, `tab "${t.key}" links to #${t.chapter.slug}, which manual ${manifest.version} does not have`).toBeDefined();
      expect(t.chapter.title, `tab "${t.key}" chapter title drifted from manual ${manifest.version}`).toBe(chapter!.title);
    }
  });

  it('the newest manual release is free, as the page claims in five places', () => {
    const manifest = latestManifest();
    const notFree = manifest.chapters.filter(c => !c.free).map(c => c.slug);
    expect(notFree, `manual ${manifest.version} has non-free chapters; the page's "free" wording would be false`).toEqual([]);
  });

  it('links each tab to its chapter, and falls back to the manual root for an unknown slug', () => {
    const manifest = latestManifest();
    const toc = { chapters: manifest.chapters.map(c => ({ slug: c.slug, title: c.title, blurb: c.blurb, free: !!c.free })) } as ManualToc;
    for (const t of TABS) {
      expect(chapterHref(t.chapter.slug, toc)).toBe(`/products/session-manager/manual#${t.chapter.slug}`);
      // No TOC yet (loading or failed): still the deep link.
      expect(chapterHref(t.chapter.slug, null)).toBe(`/products/session-manager/manual#${t.chapter.slug}`);
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(chapterHref('no-such-chapter', toc)).toBe('/products/session-manager/manual');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('fills the kicker template the way the design shows it', () => {
    expect(fill(COPY.partsBin.kickerTemplate, { nn: partNumber(1), LABEL: TABS[1].label.toUpperCase() })).toBe('PART 02 · SCHEDULER');
    expect(fill(COPY.ctas.manual.subtitleTemplate, { n: 13 })).toBe('13 chapters of tips & tricks');
  });
});

describe('layoutMode (the desktop canvas rule)', () => {
  it.each([
    [1440, 860, 'canvas', 1],
    [1920, 1080, 'canvas', 1.255814],
    [1280, 720, 'canvas', 0.837209],
    [1080, 645, 'canvas', 0.75],
    [1280, 640, 'reflow', 0.744186],
    [1066, 790, 'reflow', null],
    [844, 390, 'reflow', null],
    [390, 844, 'reflow', null],
  ] as const)('%ix%i → %s', (vw, vh, mode, scale) => {
    const l = layoutMode(vw, vh);
    expect(l.mode).toBe(mode);
    if (scale !== null) expect(l.scale).toBeCloseTo(scale, 5);
  });

  it('centres the scaled canvas in the letterbox', () => {
    const l = layoutMode(1920, 1080);
    expect(l.offY).toBeCloseTo(0, 5);
    expect(l.offX).toBeCloseTo((1920 - 1440 * l.scale) / 2, 5);
    expect(layoutMode(1440, 860)).toMatchObject({ offX: 0, offY: 0 });
  });

  it('survives a zero or missing viewport', () => {
    expect(layoutMode(0, 0).mode).toBe('canvas');
    expect(layoutMode(Number.NaN, 860).mode).toBe('canvas');
  });
});

describe('filmPanelCanvasStyle (the film panel in canvas mode)', () => {
  // The panel's top edge in viewport px, as the browser resolves the inline
  // style: `top` is calc(50% - Npx) of the viewport-sized dialog, and the
  // transform scales about the panel's top centre, so it never moves that edge.
  const panelTop = (vh: number, scale: number) => {
    const m = /^calc\(50% - ([\d.]+)px\)$/.exec(filmPanelCanvasStyle(scale).top);
    expect(m, 'top is calc(50% - Npx)').not.toBeNull();
    return vh / 2 - Number(m![1]);
  };

  it.each([
    [1440, 860],
    [1920, 1080],
    [1280, 720],
    [1080, 645],
    [2560, 1080],
    [1440, 1200],
  ] as const)('puts the panel top at the mock\'s 52 canvas px at %ix%i', (vw, vh) => {
    const l = layoutMode(vw, vh);
    expect(l.mode).toBe('canvas');
    // V2:137: left 200, top 52 on the 1440x860 canvas.
    expect(panelTop(vh, l.scale)).toBeCloseTo(l.offY + 52 * l.scale, 3);
  });

  it('scales about the top centre and centres horizontally', () => {
    expect(filmPanelCanvasStyle(0.837209).transform).toBe('translateX(-50%) scale(0.837209)');
  });
});

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [57.002, '0:57'],
    [59.9, '0:59'],
    [61, '1:01'],
    [-3, '0:00'],
    [Number.NaN, '0:00'],
    [Number.POSITIVE_INFINITY, '0:00'],
  ])('%s → %s', (s, out) => {
    expect(formatTime(s)).toBe(out);
  });
});

describe('Parts Bin keyboard', () => {
  it('moves on both axes, wraps, and jumps with Home/End', () => {
    expect(nextTabIndex('ArrowDown', 0, 9)).toBe(1);
    expect(nextTabIndex('ArrowRight', 8, 9)).toBe(0);
    expect(nextTabIndex('ArrowUp', 0, 9)).toBe(8);
    expect(nextTabIndex('ArrowLeft', 4, 9)).toBe(3);
    expect(nextTabIndex('Home', 5, 9)).toBe(0);
    expect(nextTabIndex('End', 2, 9)).toBe(8);
    expect(nextTabIndex('Enter', 2, 9)).toBeNull();
  });
});

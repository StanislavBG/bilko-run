/**
 * Pure layout + formatting helpers for the Session Manager landing page.
 *
 * No DOM access at import time, so tests/session-manager-landing.test.ts can
 * exercise them under vitest's node environment.
 */

/** The Claude Design mock is a fixed 1440x860 canvas. */
const CANVAS_W = 1440;
const CANVAS_H = 860;

/** Narrowest viewport, and smallest scale, at which the canvas stays readable. */
const CANVAS_MIN_VW = 1080;
const CANVAS_MIN_SCALE = 0.75;

export type LayoutModeName = 'canvas' | 'reflow';

export interface LayoutMode {
  mode: LayoutModeName;
  /** min(vw/1440, vh/860). Only meaningful in canvas mode. */
  scale: number;
  /** Left/top offsets that centre the scaled canvas (letterbox bars). */
  offX: number;
  offY: number;
}

/**
 * The desktop canvas rule (DESIGN_SPEC.md, "Layout mode").
 *
 * `vw`/`vh` are window.innerWidth/innerHeight, which already shrink as the
 * browser zooms in — so zooming past ~135% on a 1440-wide screen drops to the
 * reflow layout and text actually gets bigger (WCAG 1.4.4), instead of the
 * canvas quietly rescaling itself back to the same physical size.
 */
export function layoutMode(vw: number, vh: number): LayoutMode {
  const w = Number.isFinite(vw) && vw > 0 ? vw : CANVAS_W;
  const h = Number.isFinite(vh) && vh > 0 ? vh : CANVAS_H;
  const scale = Math.min(w / CANVAS_W, h / CANVAS_H);
  // Round to dodge float noise at the exact boundary (1080x645 → 0.75).
  const s = Math.round(scale * 1e6) / 1e6;
  const mode: LayoutModeName = w >= CANVAS_MIN_VW && s >= CANVAS_MIN_SCALE ? 'canvas' : 'reflow';
  return {
    mode,
    scale: s,
    offX: Math.max(0, (w - CANVAS_W * s) / 2),
    offY: Math.max(0, (h - CANVAS_H * s) / 2),
  };
}

/** The mock's film panel sits at left 200, top 52 on the 1440x860 canvas (V2:137). */
const FILM_PANEL_TOP = 52;

/**
 * Inline style for the film panel in canvas mode. It pins the panel's top edge
 * where the mock has it, 52 canvas px below the canvas top, rather than
 * centring it: the 713px stack centred sat 21.5 canvas px low. The scaled
 * canvas is always centred in the viewport, so its top edge is at
 * 50% - 430·s and the panel's at 50% - 378·s. The stylesheet puts the
 * transform origin at the panel's top centre, so scale(s) keeps that edge put
 * and translateX(-50%) centres it horizontally (x = 200·s on the canvas).
 */
export function filmPanelCanvasStyle(scale: number): { top: string; transform: string } {
  return {
    top: `calc(50% - ${(CANVAS_H / 2 - FILM_PANEL_TOP) * scale}px)`,
    transform: `translateX(-50%) scale(${scale})`,
  };
}

/** Seconds → `m:ss` (0 → 0:00, 57.002 → 0:57). Non-finite or negative → 0:00. */
export function formatTime(seconds: number): string {
  const t = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** 0 → "01" — the Parts Bin's part numbers. */
export function partNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** Next tab index for a key in the Parts Bin tablist, or null if the key doesn't move focus. */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowUp':
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** The landing is two pages that flip vertically: the cover, then the Parts Bin. */
export const PAGE_COUNT = 2;

/** Target page for a key press (clamped to the page range), or null if the key doesn't turn. */
export function pageForKey(key: string, shift: boolean, current: number): number | null {
  const last = PAGE_COUNT - 1;
  switch (key) {
    case 'PageDown':
    case 'ArrowDown':
      return Math.min(last, current + 1);
    case ' ':
      return shift ? Math.max(0, current - 1) : Math.min(last, current + 1);
    case 'PageUp':
    case 'ArrowUp':
      return Math.max(0, current - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

/** Wheel `deltaMode` multipliers: lines → px, pages → px. */
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 860;

/**
 * Stateful wheel gesture detector. Accumulates deltaY until |sum| reaches the
 * threshold, returns +1/-1 once, then returns 0 for every call until one arrives
 * `quietMs` or more after the previous call (absorbs trackpad inertia), which
 * re-arms it with a fresh sum.
 */
export function createWheelTurner(
  opts: { threshold?: number; quietMs?: number } = {},
): (deltaY: number, deltaMode: number, now: number) => -1 | 0 | 1 {
  const threshold = opts.threshold ?? 80;
  const quietMs = opts.quietMs ?? 450;
  let sum = 0;
  let spent = false;
  let last = -Infinity;
  return (deltaY, deltaMode, now) => {
    if (now - last >= quietMs) {
      sum = 0;
      spent = false;
    }
    last = now;
    if (spent) return 0;
    sum += deltaY * (deltaMode === 1 ? WHEEL_LINE_PX : deltaMode === 2 ? WHEEL_PAGE_PX : 1);
    if (Math.abs(sum) < threshold) return 0;
    spent = true;
    return sum > 0 ? 1 : -1;
  };
}

/** Vertical swipe on touchend: swipe up (dy < 0) → next (1), down → previous (-1), else 0. */
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dy) < 60 || Math.abs(dy) <= Math.abs(dx)) return 0;
  return dy < 0 ? 1 : -1;
}

const PARTS_HASH = '#parts';

/** `#parts` is page 2; anything else is the cover. */
export function pageFromHash(hash: string): number {
  return hash === PARTS_HASH ? 1 : 0;
}

/** Inverse of pageFromHash: `#parts` for page 2, '' for the cover. */
export function hashForPage(page: number): string {
  return page === 1 ? PARTS_HASH : '';
}

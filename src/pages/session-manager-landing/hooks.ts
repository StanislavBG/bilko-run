import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { fetchManualToc } from '../../lib/manualClient.js';
import type { ManualToc } from '../../../shared/manual-catalog.js';
import {
  createWheelTurner,
  hashForPage,
  layoutMode,
  PAGE_COUNT,
  pageForKey,
  pageFromHash,
  swipeDirection,
  type LayoutMode,
} from './layout.js';

function currentLayout(): LayoutMode {
  if (typeof window === 'undefined') return layoutMode(1440, 860);
  return layoutMode(window.innerWidth, window.innerHeight);
}

/**
 * Canvas vs reflow, decided in JS from the window size and recomputed on
 * resize. The initialiser runs before first paint (client-only SPA), so there
 * is no canvas→reflow flash on a phone.
 */
export function useLayoutMode(): LayoutMode {
  const [layout, setLayout] = useState<LayoutMode>(currentLayout);

  useLayoutEffect(() => {
    let frame = 0;
    const apply = () =>
      setLayout(prev => {
        const next = currentLayout();
        return prev.mode === next.mode && prev.scale === next.scale && prev.offX === next.offX && prev.offY === next.offY
          ? prev
          : next;
      });
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    // Catch a resize between the initialiser and this effect.
    apply();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return layout;
}

/**
 * The fixed canvas never scrolls, so a stray body scrollbar (another route's
 * leftover height, a Clerk portal) would only ever show as a dead gutter.
 * Lock body overflow while — and only while — the page is mounted in canvas
 * mode, and put back exactly what was there before.
 */
export function useBodyOverflowLock(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previous;
    };
  }, [active]);
}

const FONT_LINK_ID = 'smlp-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600;1,8..60,700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap';

/**
 * Page-scoped web fonts. Injected as one `<link rel="stylesheet">` (plus
 * preconnects) on mount and removed on unmount, so the rest of bilko.run never
 * pays for Source Serif 4 / Inter Tight. A `<link>` to fonts.googleapis.com is
 * allowed by the CSP's style-src; a runtime `<style>` element would not be
 * (it carries no nonce), so none is ever created here.
 */
export function usePageFonts(): void {
  useEffect(() => {
    const added: HTMLLinkElement[] = [];
    const add = (id: string, attrs: Record<string, string>) => {
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
      document.head.appendChild(link);
      added.push(link);
    };
    add('smlp-preconnect-css', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    add('smlp-preconnect-files', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
    add(FONT_LINK_ID, { rel: 'stylesheet', href: FONT_HREF });
    return () => {
      for (const link of added) link.remove();
    };
  }, []);
}

/**
 * The live Field Manual table of contents, fetched once. `null` while loading
 * or when the request fails — callers render the copy's fallback wording then.
 */
export function useManualToc(): ManualToc | null {
  const [toc, setToc] = useState<ManualToc | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchManualToc()
      .then(res => {
        if (!cancelled && res?.toc && Array.isArray(res.toc.chapters)) setToc(res.toc);
      })
      .catch(() => { /* fallback copy stays */ });
    return () => { cancelled = true; };
  }, []);
  return toc;
}

/** True when the visitor asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** Longest a flip may hold the turn lock if `transitionend` never fires. */
const FLIP_FALLBACK_MS = 900;
const KEY_SKIP_TARGETS = 'input, textarea, select, [contenteditable], [role="tablist"]';

/**
 * Page-turn state for the two-page book: the active page, the turn lock, and
 * the URL hash kept in step (both directions). `pagesRef` is the element that
 * gets the instant-apply class when the hash changes from outside.
 */
export function useBookPages(pagesRef: RefObject<HTMLDivElement>) {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  const focusAfterTurn = useRef(false);
  const pageRef = useRef(page);
  pageRef.current = page;
  const turning = useRef(false);
  const turnTimer = useRef<number | undefined>(undefined);

  const endTurn = useCallback(() => {
    turning.current = false;
    window.clearTimeout(turnTimer.current);
  }, []);

  const turnTo = useCallback((n: number, opts?: { focus?: boolean }) => {
    if (n < 0 || n >= PAGE_COUNT || n === pageRef.current || turning.current) return;
    turning.current = true;
    window.clearTimeout(turnTimer.current);
    turnTimer.current = window.setTimeout(endTurn, FLIP_FALLBACK_MS);
    focusAfterTurn.current = !!opts?.focus;
    pageRef.current = n;
    setPage(n);
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${search}${hashForPage(n)}`);
  }, [endTurn]);

  useEffect(() => () => window.clearTimeout(turnTimer.current), []);

  useEffect(() => {
    const onHash = () => {
      focusAfterTurn.current = false;
      const next = pageFromHash(window.location.hash);
      if (next === pageRef.current) return;
      // Applied without animation: suppress the transition for two frames.
      const pages = pagesRef.current;
      pages?.classList.add('smlp-pages--instant');
      endTurn();
      pageRef.current = next;
      setPage(next);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => pages?.classList.remove('smlp-pages--instant')),
      );
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [endTurn, pagesRef]);

  return { page, pageRef, turning, focusAfterTurn, endTurn, turnTo };
}

/** Canvas-only turn inputs: wheel, keys, touch swipes. Reflow keeps normal scroll. */
export function useCanvasTurnInputs({
  canvas,
  filmOpen,
  rootRef,
  pageRef,
  turnTo,
  turnToManual,
}: {
  canvas: boolean;
  filmOpen: boolean;
  rootRef: RefObject<HTMLDivElement>;
  pageRef: MutableRefObject<number>;
  turnTo: (n: number, opts?: { focus?: boolean }) => void;
  turnToManual: () => void;
}): void {
  useEffect(() => {
    if (!canvas) return;
    const root = rootRef.current;
    if (!root) return;
    const wheelTurner = createWheelTurner();
    const onWheel = (e: WheelEvent) => {
      if (filmOpen) return;
      e.preventDefault();
      const dir = wheelTurner(e.deltaY, e.deltaMode, performance.now());
      if (dir === 0) return;
      if (dir > 0 && pageRef.current === PAGE_COUNT - 1) turnToManual();
      else turnTo(pageRef.current + dir);
    };
    const onKey = (e: KeyboardEvent) => {
      if (filmOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(KEY_SKIP_TARGETS)) return;
      if (e.key === ' ' && target?.closest('button, a')) return;
      const next = pageForKey(e.key, e.shiftKey, pageRef.current);
      if (next === null) return;
      e.preventDefault();
      const forward = e.key === 'PageDown' || e.key === 'ArrowDown' || (e.key === ' ' && !e.shiftKey);
      if (forward && pageRef.current === PAGE_COUNT - 1) {
        turnToManual();
        return;
      }
      turnTo(next, { focus: true });
    };
    let startX = 0;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (filmOpen || !t) return;
      const dir = swipeDirection(t.clientX - startX, t.clientY - startY);
      if (dir === 0) return;
      if (dir > 0 && pageRef.current === PAGE_COUNT - 1) turnToManual();
      else turnTo(pageRef.current + dir);
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      root.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchend', onTouchEnd);
    };
  }, [canvas, filmOpen, rootRef, pageRef, turnTo, turnToManual]);
}

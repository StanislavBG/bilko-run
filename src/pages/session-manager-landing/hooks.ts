import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { fetchManualToc } from '../../lib/manualClient.js';
import type { ManualToc } from '../../../shared/manual-catalog.js';
import { COPY } from './copy.js';
import { layoutMode, type LayoutMode } from './layout.js';

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

export type CopyStatus = 'idle' | 'copied' | 'failed';
export type CopySource = 'tag' | 'end';

export interface CopyInstall {
  status: CopyStatus;
  /** Which button asked — the end card only shows its failure state for its own clicks. */
  source: CopySource;
  copy: (from: CopySource) => void;
  tagCodeRef: RefObject<HTMLElement>;
  endCodeRef: RefObject<HTMLElement>;
}

function selectContents(el: HTMLElement | null): boolean {
  if (!el) return false;
  try {
    const sel = window.getSelection();
    if (!sel) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch {
    return false;
  }
}

/**
 * One copy state per page, shared by the price tag and the film's end card.
 *
 * Unlike the mock (which said "Copied" even when the Clipboard API was missing
 * or refused), "Copied" only shows after `writeText` resolves — or after the
 * `execCommand('copy')` fallback reports success. Otherwise the command text is
 * left selected so the visitor can press Cmd/Ctrl-C, and the label says so.
 */
export function useCopyInstall(): CopyInstall {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const [source, setSource] = useState<CopySource>('tag');
  const tagCodeRef = useRef<HTMLElement>(null);
  const endCodeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = useCallback((next: CopyStatus, ms: number) => {
    clearTimeout(timer.current);
    setStatus(next);
    timer.current = setTimeout(() => setStatus('idle'), ms);
  }, []);

  const copy = useCallback((from: CopySource) => {
    setSource(from);
    const command = COPY.meta.installCommand;
    const fallback = () => {
      // The end card's command box only renders on failure: reveal it
      // synchronously so there is something to select. The price tag's box is
      // always on screen, so that path never flashes the failure label.
      if (from === 'end' && !endCodeRef.current) {
        flushSync(() => {
          clearTimeout(timer.current);
          setStatus('failed');
        });
      }
      const target = from === 'end' ? endCodeRef.current : tagCodeRef.current;
      let ok = false;
      if (selectContents(target)) {
        try {
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        }
      }
      settle(ok ? 'copied' : 'failed', ok ? 2200 : 4000);
    };

    const writeText = typeof navigator !== 'undefined' ? navigator.clipboard?.writeText : undefined;
    if (!writeText) {
      fallback();
      return;
    }
    navigator.clipboard.writeText(command).then(
      () => settle('copied', 2200),
      () => fallback(),
    );
  }, [settle]);

  return { status, source, copy, tagCodeRef, endCodeRef };
}

/** True when the visitor asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

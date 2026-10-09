/**
 * Cross-route "book turn" for the Session Manager landing and the Field Manual.
 *
 * Wraps a route change in a View Transition so the page flips like the in-page
 * cover → Parts Bin flip. No DOM access at import time, so
 * tests/session-manager-book.test.ts can run it under vitest's node environment.
 * The CSS lives in src/styles/session-manager-landing.css ("Book turn").
 */

import { flushSync } from 'react-dom';

export type BookDirection = 'forward' | 'back';

interface BookTurnOptions {
  animate?: boolean;
}

interface ViewTransitionLike {
  finished: Promise<unknown>;
}

/** The typed `{ update, types }` form is newer than the TS lib, so type it here. */
type StartViewTransition = (
  arg: (() => void | Promise<void>) | { update: () => void | Promise<void>; types: string[] },
) => ViewTransitionLike;

export async function turnBook(
  dir: BookDirection,
  update: () => void | Promise<void>,
  opts?: BookTurnOptions,
): Promise<void> {
  const doc = typeof document === 'undefined' ? undefined : document;
  const start = (doc as unknown as { startViewTransition?: StartViewTransition } | undefined)?.startViewTransition;
  if (opts?.animate === false || !doc || typeof start !== 'function') {
    await update();
    return;
  }

  let transition: ViewTransitionLike;
  let attr = false;
  try {
    transition = start.call(doc, { update, types: ['book-' + dir] });
  } catch {
    // Browsers without typed transitions: gate the CSS on a data attribute instead.
    doc.documentElement.dataset.bookTurn = dir;
    attr = true;
    transition = start.call(doc, update);
  }
  try {
    await transition.finished;
  } catch {
    // An aborted transition still ran (or skipped) update; nothing to recover.
  } finally {
    if (attr) delete doc.documentElement.dataset.bookTurn;
  }
}

let readyWaiters: Array<() => void> = [];

/** Called by the destination page once its content is painted-ready. */
export function markBookPageReady(): void {
  const waiters = readyWaiters;
  readyWaiters = [];
  for (const resolve of waiters) resolve();
}

/** Resolves on the next markBookPageReady() or after `timeoutMs`; earlier marks don't count. */
export function waitForBookPageReady(timeoutMs = 1500): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      readyWaiters = readyWaiters.filter((w) => w !== done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    readyWaiters.push(done);
  });
}

export function shouldInterceptClick(
  e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  target?: string | null,
): boolean {
  return (
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    !e.defaultPrevented &&
    target !== '_blank'
  );
}

export function bookNavigate(
  navigate: (to: string) => void,
  href: string,
  dir: BookDirection,
  opts?: BookTurnOptions,
): Promise<void> {
  return turnBook(
    dir,
    async () => {
      if (/\/manual\b/.test(href)) await import('../ManualPage.js');
      const ready = waitForBookPageReady();
      flushSync(() => navigate(href));
      await ready;
    },
    opts,
  );
}

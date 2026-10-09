/**
 * Cross-route book-turn primitive (src/pages/session-manager-landing/bookTurn.ts).
 * Runs under vitest's node environment, so `document` is stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markBookPageReady,
  shouldInterceptClick,
  turnBook,
  waitForBookPageReady,
} from '../src/pages/session-manager-landing/bookTurn.js';

type Doc = { documentElement: { dataset: Record<string, string> }; startViewTransition?: unknown };

function stubDoc(startViewTransition?: unknown): Doc {
  const doc: Doc = { documentElement: { dataset: {} }, startViewTransition };
  vi.stubGlobal('document', doc);
  return doc;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('turnBook', () => {
  it('runs update without throwing when startViewTransition is missing', async () => {
    stubDoc();
    const update = vi.fn();
    await expect(turnBook('forward', update)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('uses the typed object form', async () => {
    const svt = vi.fn((arg: { update: () => void; types: string[] }) => {
      void arg.update();
      return { finished: Promise.resolve() };
    });
    stubDoc(svt);
    const update = vi.fn();
    await turnBook('back', update);
    expect(svt).toHaveBeenCalledTimes(1);
    expect(svt.mock.calls[0][0].types).toEqual(['book-back']);
    expect(svt.mock.calls[0][0].update).toBe(update);
  });

  it('falls back to the function form with a data attribute when the object form throws', async () => {
    let resolveFinished!: () => void;
    const finished = new Promise<void>((r) => (resolveFinished = r));
    let attrDuring: string | undefined;
    const svt = vi.fn((arg: unknown) => {
      if (typeof arg === 'object') throw new TypeError('not supported');
      attrDuring = doc.documentElement.dataset.bookTurn;
      return { finished };
    });
    const doc = stubDoc(svt);
    const update = vi.fn();
    const p = turnBook('forward', update);
    await Promise.resolve();
    expect(svt).toHaveBeenCalledTimes(2);
    expect(svt.mock.calls[1][0]).toBe(update);
    expect(attrDuring).toBe('forward');
    resolveFinished();
    await p;
    expect(doc.documentElement.dataset.bookTurn).toBeUndefined();
  });

  it('skips the API when animate is false', async () => {
    const svt = vi.fn();
    stubDoc(svt);
    const update = vi.fn();
    await turnBook('forward', update, { animate: false });
    expect(svt).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('shouldInterceptClick', () => {
  const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
  it('is true for a plain primary click', () => {
    expect(shouldInterceptClick(base)).toBe(true);
    expect(shouldInterceptClick(base, '_self')).toBe(true);
    expect(shouldInterceptClick(base, null)).toBe(true);
  });
  it('is false for other buttons, modifiers, prevented clicks and _blank', () => {
    expect(shouldInterceptClick({ ...base, button: 1 })).toBe(false);
    expect(shouldInterceptClick({ ...base, metaKey: true })).toBe(false);
    expect(shouldInterceptClick({ ...base, ctrlKey: true })).toBe(false);
    expect(shouldInterceptClick({ ...base, shiftKey: true })).toBe(false);
    expect(shouldInterceptClick({ ...base, altKey: true })).toBe(false);
    expect(shouldInterceptClick({ ...base, defaultPrevented: true })).toBe(false);
    expect(shouldInterceptClick(base, '_blank')).toBe(false);
  });
});

describe('waitForBookPageReady', () => {
  beforeEach(() => vi.useFakeTimers());

  it('resolves on the next mark', async () => {
    const p = waitForBookPageReady(1500);
    markBookPageReady();
    await expect(p).resolves.toBeUndefined();
  });

  it('resolves on timeout', async () => {
    const p = waitForBookPageReady(1500);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toBeUndefined();
  });

  it('does not count a mark that happened before the wait', async () => {
    markBookPageReady();
    let done = false;
    const p = waitForBookPageReady(1500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    await p;
    expect(done).toBe(true);
  });
});

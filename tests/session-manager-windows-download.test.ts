/**
 * Renders WindowsDownload under both values of `windowsAvailable`. The live
 * flag is true (the .exe ships); the coming-soon fallback is kept for a future
 * release that lacks the installer, so it is exercised here with a mocked copy.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const COPY_MODULE = '../src/pages/session-manager-landing/copy.js';

async function renderWindows(windowsAvailable?: boolean) {
  vi.resetModules();
  if (windowsAvailable !== undefined) {
    vi.doMock(COPY_MODULE, async () => {
      const real = await vi.importActual<typeof import('../src/pages/session-manager-landing/copy.js')>(COPY_MODULE);
      const copy = structuredClone(real.COPY);
      copy.priceTag.downloads.windows.windowsAvailable = windowsAvailable;
      return { ...real, COPY: copy };
    });
  }
  const { WindowsDownload } = await import('../src/pages/session-manager-landing/Downloads.js');
  return renderToStaticMarkup(createElement(WindowsDownload));
}

afterEach(() => {
  vi.doUnmock(COPY_MODULE);
  vi.resetModules();
});

describe('WindowsDownload', () => {
  it('renders a download link to the .exe with the live flag', async () => {
    const html = await renderWindows();
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="https://github.com/StanislavBG/claude-code-session-manager/releases/latest/download/Session-Manager-win-x64.exe"');
    expect(html).toContain('Download for Windows');
    expect(html).not.toContain('aria-disabled');
  });

  it('falls back to an inert aria-disabled span when windowsAvailable is false', async () => {
    const html = await renderWindows(false);
    expect(html).toMatch(/^<span class="smlp-dl smlp-dl--soon"/);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Windows — coming soon');
    expect(html).not.toContain('href');
    expect(html).not.toContain('<a');
  });
});

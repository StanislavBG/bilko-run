import { COPY } from './copy.js';

/**
 * Installer download buttons, shared by the price tag and the film's end card.
 * Both read COPY.priceTag.downloads, so one flag gates Windows everywhere.
 */

const dl = COPY.priceTag.downloads;

/** False until the GitHub release carries the Windows installer. */
export const windowsAvailable: boolean = dl.windows.windowsAvailable;

function AppleGlyph() {
  return (
    <svg className="smlp-dl__glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 2.99.72 1.24-.02 2.02-1.12 2.77-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66ZM14.1 5.85c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.67 1.37-.58.67-1.09 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.28Z"
      />
    </svg>
  );
}

function WindowsGlyph() {
  return (
    <svg className="smlp-dl__glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M3 5.1 10.4 4v7.1H3V5.1Zm8.3-1.2L21 2.5v8.6h-9.7V3.9ZM3 12.9h7.4V20L3 18.9v-6Zm8.3 0H21v8.6l-9.7-1.4v-7.2Z" />
    </svg>
  );
}

export function MacDownload({ className = '' }: { className?: string }) {
  return (
    <a className={`smlp-dl ${className}`.trim()} href={dl.mac.href} download>
      <AppleGlyph />
      <span>{dl.mac.label}</span>
    </a>
  );
}

/**
 * The Windows download link — or, while `windowsAvailable` is false, an inert
 * "coming soon" element: no href, aria-disabled, nothing to click.
 */
export function WindowsDownload({ className = '' }: { className?: string }) {
  if (!windowsAvailable) {
    return (
      <span className={`smlp-dl smlp-dl--soon ${className}`.trim()} aria-disabled="true">
        <WindowsGlyph />
        <span>{dl.windows.comingSoonLabel}</span>
      </span>
    );
  }
  return (
    <a className={`smlp-dl ${className}`.trim()} href={dl.windows.href} download>
      <WindowsGlyph />
      <span>{dl.windows.label}</span>
    </a>
  );
}

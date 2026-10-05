import type { CopyInstall } from './hooks.js';

interface Props {
  copier: CopyInstall;
  labels: { copy: string; copied: string; failed: string };
  className: string;
}

/**
 * Copy-the-install-command button (the film's end card).
 *
 * All three labels share one grid cell and only the current one is shown.
 * The end card's action row wraps and centres, so the inactive labels are
 * hidden outright (see the stylesheet) and the button is as wide as its
 * current label, as designed.
 */
export function CopyButton({ copier, labels, className }: Props) {
  const state = copier.status === 'copied' ? 'copied' : copier.status === 'failed' ? 'failed' : 'copy';
  return (
    <button
      type="button"
      className={`smlp-copy ${className}`}
      data-state={state}
      onClick={e => {
        e.stopPropagation();
        copier.copy();
      }}
    >
      <span className="smlp-copy__label" data-on={state === 'copy'}>{labels.copy}</span>
      <span className="smlp-copy__label smlp-copy__label--small" data-on={state === 'copied'}>{labels.copied}</span>
      <span className="smlp-copy__label smlp-copy__label--small" data-on={state === 'failed'}>{labels.failed}</span>
    </button>
  );
}

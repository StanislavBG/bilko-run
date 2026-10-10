import type { CopyInstall } from './hooks.js';

interface Props {
  copier: CopyInstall;
  labels: { copy: string; copied: string; failed: string };
  className: string;
}

/**
 * Copy-the-install-command button.
 *
 * All three labels are stacked in one grid cell and only the current one is
 * visible, so the button is always as tall as its longest label and the price
 * tag never changes height. Hidden labels use `visibility:hidden`, which also
 * drops them from the accessible name.
 */
export function CopyButton({ copier, labels, className }: Props) {
  const state = copier.status === 'idle' ? 'copy' : copier.status;
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

import type { CopyInstall, CopySource } from './hooks.js';

interface Props {
  copier: CopyInstall;
  from: CopySource;
  labels: { copy: string; copied: string; failed: string };
  className: string;
}

/**
 * Copy-the-install-command button.
 *
 * All three labels are stacked in one grid cell and only the current one is
 * visible, so the button is always as tall as its longest label: switching to
 * "Copied — now paste it in your terminal" can never grow the price tag (the
 * mock's version jumped 20px). Hidden labels use `visibility:hidden`, which
 * also drops them from the accessible name. The film's end card, whose action
 * row wraps and centres, hides the inactive labels outright instead (see the
 * stylesheet), so its button is as wide as its current label, as designed.
 */
export function CopyButton({ copier, from, labels, className }: Props) {
  const state =
    copier.status === 'copied' ? 'copied' : copier.status === 'failed' && copier.source === from ? 'failed' : 'copy';
  return (
    <button
      type="button"
      className={`smlp-copy ${className}`}
      data-state={state}
      onClick={e => {
        e.stopPropagation();
        copier.copy(from);
      }}
    >
      <span className="smlp-copy__label" data-on={state === 'copy'}>{labels.copy}</span>
      <span className="smlp-copy__label smlp-copy__label--small" data-on={state === 'copied'}>{labels.copied}</span>
      <span className="smlp-copy__label smlp-copy__label--small" data-on={state === 'failed'}>{labels.failed}</span>
    </button>
  );
}

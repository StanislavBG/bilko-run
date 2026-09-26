import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { COPY, fill } from './copy.js';
import { CopyButton } from './CopyButton.js';
import { prefersReducedMotion, type CopyInstall } from './hooks.js';
import { filmPanelCanvasStyle, formatTime, type LayoutMode } from './layout.js';

const RATES = [1, 1.5, 2] as const;
/** The film is 57.002 s; used for seeking until `loadedmetadata` reports the real value. */
const FALLBACK_DURATION = 57;

interface Props {
  open: boolean;
  onClose: () => void;
  layout: LayoutMode;
  copier: CopyInstall;
  /** Copy-result announcement; the page's own status region is inert while this is modal. */
  statusMessage: string;
}

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

function exitFullscreen(d: FsDocument): void {
  try {
    const result = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.();
    if (result instanceof Promise) result.catch(() => {});
  } catch { /* not fullscreen after all */ }
}

function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/**
 * "Pip and the Paper Moon" — the 57-second film, in a native modal <dialog>
 * portalled onto <body>.
 *
 * Being in the top layer, its ::backdrop covers the whole real viewport
 * (including the canvas letterbox bars the mock's in-canvas backdrop missed),
 * and showModal() makes the page inert and traps focus. In canvas mode the
 * panel is scaled by the same factor as the page; in reflow it fills the
 * viewport unscaled.
 *
 * The custom controls drive a real <video> and only ever reflect its events —
 * no simulated clock.
 */
export function FilmDialog({ open, onClose, layout, copier, statusMessage }: Props) {
  const film = COPY.film;
  const end = COPY.endCard;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [rate, setRate] = useState<number>(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [broken, setBroken] = useState(false);
  // Once a failed copy reveals the end card's command box, keep it (and the
  // selection in it) until the end card goes away, not just for the 4 s label.
  const [keepEndCmd, setKeepEndCmd] = useState(false);
  // The dialog is always mounted (it is closed, not absent), so the <video>
  // gets its src and poster only once the film is first opened: a page view
  // that never clicks "Watch it run" downloads neither the 1920x1080 poster
  // nor the MP4's first range. Set during render, so the commit that opens the
  // dialog already carries the src and the open effect's play() still runs
  // inside the click's user gesture. Once armed it stays armed.
  const [armed, setArmed] = useState(false);
  if (open && !armed) setArmed(true);

  const total = duration ?? FALLBACK_DURATION;
  const canvas = layout.mode === 'canvas';

  // Open / close the native dialog in step with `open`.
  useEffect(() => {
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog) return;
    // A seek drag never outlives a close/open: Escape can close the dialog
    // while the button is still held on the track, and the pointerup that
    // would end the drag then never reaches it.
    dragging.current = false;
    if (open) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      }
      setEnded(false);
      if (video) {
        try {
          video.currentTime = 0;
        } catch { /* metadata not loaded yet — it starts at 0 anyway */ }
        setTime(0);
        // The click that opened us is the user gesture, so sound is allowed.
        // Reduced motion never autoplays: open paused on the poster.
        if (!prefersReducedMotion()) video.play().catch(() => { /* stays paused, big play shows */ });
      }
      playRef.current?.focus();
    } else {
      video?.pause();
      if (stageRef.current && fullscreenElement() === stageRef.current) {
        const d = document as FsDocument;
        exitFullscreen(d);
      }
      if (dialog.open) dialog.close();
    }
  }, [open]);

  // Smooth knob while playing; `timeupdate` alone only fires ~4x a second.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && !dragging.current) setTime(v.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!stageRef.current && fullscreenElement() === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.ended || ended) {
      v.currentTime = 0;
      v.play().catch(() => {});
      return;
    }
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, [ended]);

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };

  const seekTo = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(total, seconds));
    try {
      v.currentTime = clamped;
    } catch { /* not seekable yet */ }
    setTime(clamped);
  };

  // getBoundingClientRect() ratios stay correct under the canvas scale.
  const seekToPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    seekTo(((e.clientX - r.left) / r.width) * total);
  };

  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 10, PageDown: -10 };
    if (e.key in step) {
      e.preventDefault();
      seekTo((videoRef.current?.currentTime ?? time) + step[e.key]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      seekTo(total);
    }
  };

  const cycleRate = () => {
    const v = videoRef.current;
    if (!v) return;
    const i = RATES.indexOf(v.playbackRate as (typeof RATES)[number]);
    v.playbackRate = RATES[(i + 1) % RATES.length];
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

  const toggleFullscreen = () => {
    const stage = stageRef.current as FsElement | null;
    const video = videoRef.current as IosVideo | null;
    const d = document as FsDocument;
    if (fullscreenElement()) {
      exitFullscreen(d);
      return;
    }
    if (stage?.requestFullscreen) {
      stage.requestFullscreen().catch(() => {});
    } else if (stage?.webkitRequestFullscreen) {
      stage.webkitRequestFullscreen();
    } else if (video?.webkitEnterFullscreen) {
      // iPhone Safari has no element fullscreen — hand over to the native player.
      video.webkitEnterFullscreen();
    }
  };

  // Space toggles play only when focus isn't on a control (where Space already
  // has a native job). Scoped to the dialog — no window-level listener.
  const onDialogKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== ' ') return;
    const target = e.target as Element | null;
    if (target?.closest('button, a, input, [role="slider"], [tabindex]:not(dialog)')) return;
    e.preventDefault();
    togglePlay();
  };

  const rateIndex = Math.max(0, RATES.indexOf(rate as (typeof RATES)[number]));
  const rateLabel = film.speedLabels[rateIndex];
  const pct = total > 0 ? Math.max(0, Math.min(100, (time / total) * 100)) : 0;
  const showBigPlay = !playing && !ended && !broken;
  const endFailed = copier.status === 'failed' && copier.source === 'end';
  useEffect(() => {
    if (endFailed) setKeepEndCmd(true);
  }, [endFailed]);
  useEffect(() => {
    if (!ended) setKeepEndCmd(false);
  }, [ended]);

  const panelStyle = canvas ? filmPanelCanvasStyle(layout.scale) : undefined;

  const dialog = (
    <dialog
      ref={dialogRef}
      className={`smlp-film smlp-film--${layout.mode}`}
      aria-label={film.aria.dialog}
      onClose={() => {
        videoRef.current?.pause();
        if (open) onClose();
      }}
      onClick={e => {
        // The dialog box itself is the backdrop area: the panel never fills it.
        if (e.target === dialogRef.current) onClose();
      }}
      onKeyDown={onDialogKeyDown}
    >
      <div className="smlp-film__panel" style={panelStyle}>
        <div className="smlp-film__head">
          <div className="smlp-film__titles">
            <span className="smlp-film__now">{film.nowShowing}</span>
            <h2 className="smlp-film__title">{film.title}</h2>
            <span className="smlp-film__runtime">{film.runtime}</span>
          </div>
          <div className="smlp-film__closer">
            <span className="smlp-film__esc" aria-hidden="true">{film.escHint}</span>
            <button type="button" className="smlp-film__close" aria-label={film.aria.close} onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <div ref={stageRef} className="smlp-film__stage" data-fullscreen={isFullscreen} data-ended={ended}>
          <div className="smlp-film__frame" data-ended={ended} onClick={togglePlay}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- narration is burned in as on-screen captions */}
            <video
              ref={videoRef}
              className="smlp-film__video"
              src={armed ? film.src : undefined}
              poster={armed ? film.poster : undefined}
              preload="metadata"
              playsInline
              onPlay={() => {
                setPlaying(true);
                setEnded(false);
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => {
                setPlaying(false);
                setEnded(true);
                setTime(videoRef.current?.duration ?? total);
              }}
              onTimeUpdate={() => {
                if (!dragging.current && videoRef.current) setTime(videoRef.current.currentTime);
              }}
              onSeeking={() => {
                const v = videoRef.current;
                if (v && Number.isFinite(v.duration) && v.currentTime < v.duration - 0.05) setEnded(false);
              }}
              onLoadedMetadata={() => {
                const d = videoRef.current?.duration;
                if (d && Number.isFinite(d)) setDuration(d);
                setBroken(false);
              }}
              onRateChange={() => setRate(videoRef.current?.playbackRate ?? 1)}
              onVolumeChange={() => setMuted(!!videoRef.current?.muted)}
              onError={() => setBroken(true)}
            >
              {film.videoFallback} <a href={film.src}>{film.videoFallbackLink}</a>
            </video>

            {broken && (
              <div className="smlp-film__broken" onClick={e => e.stopPropagation()}>
                <p>{film.videoFallback}</p>
                <a href={film.src}>{film.videoFallbackLink}</a>
              </div>
            )}

            {showBigPlay && (
              <div className="smlp-film__bigplay" aria-hidden="true">
                <span className="smlp-film__bigdisc">
                  <span className="smlp-film__bigtri" />
                </span>
              </div>
            )}

            {ended && (
              <div className="smlp-end" onClick={e => e.stopPropagation()}>
                <span className="smlp-end__badge">{end.badge}</span>
                <p className="smlp-end__headline">{end.headline}</p>
                <p className="smlp-end__body">{end.body}</p>
                <div className="smlp-end__actions">
                  <CopyButton
                    copier={copier}
                    from="end"
                    className="smlp-end__copy"
                    labels={{ copy: end.copyLabel, copied: end.copiedLabel, failed: end.copyFailedLabel }}
                  />
                  <a
                    className="smlp-end__manual"
                    href={end.manualHref}
                    onClick={() => {
                      videoRef.current?.pause();
                      onClose();
                    }}
                  >
                    {end.manualCta}
                  </a>
                </div>
                {(endFailed || keepEndCmd) && (
                  <div className="smlp-cmd smlp-end__cmd" role="group" aria-label={COPY.priceTag.aria.commandBox}>
                    <span className="smlp-cmd__prompt" aria-hidden="true">{COPY.priceTag.commandPrompt}</span>
                    <code ref={copier.endCodeRef}>{COPY.meta.installCommand}</code>
                  </div>
                )}
                <button type="button" className="smlp-end__replay" onClick={replay}>
                  {end.replay}
                </button>
              </div>
            )}
          </div>

          <div className="smlp-film__controls">
            <div className="smlp-film__transport">
              <button
                ref={playRef}
                type="button"
                className="smlp-film__play"
                aria-label={ended ? film.aria.replay : playing ? film.aria.pause : film.aria.play}
                onClick={togglePlay}
              >
                {playing ? (
                  <>
                    <span className="smlp-film__pausebar" aria-hidden="true" />
                    <span className="smlp-film__pausebar" aria-hidden="true" />
                  </>
                ) : (
                  <span className="smlp-film__playtri" aria-hidden="true" />
                )}
              </button>
              <span className="smlp-film__time" aria-hidden="true">{formatTime(time)}</span>
              <div
                role="slider"
                tabIndex={0}
                className="smlp-film__track"
                aria-label={film.aria.seek}
                aria-valuemin={0}
                aria-valuemax={Math.round(total)}
                aria-valuenow={Math.round(time)}
                aria-valuetext={fill(film.aria.seekValueTemplate, { now: formatTime(time), total: formatTime(total) })}
                onKeyDown={onTrackKey}
                onPointerDown={e => {
                  // Primary button / touch / pen only: a right-click opens the
                  // context menu, and its pointerup never reaches the track.
                  if (e.button !== 0) return;
                  dragging.current = true;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch { /* synthetic pointer */ }
                  seekToPointer(e);
                }}
                onPointerMove={e => {
                  if (dragging.current) seekToPointer(e);
                }}
                onPointerUp={e => {
                  dragging.current = false;
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch { /* already released */ }
                }}
                onPointerCancel={() => { dragging.current = false; }}
                // Capture can be lost without a pointerup on the track (the
                // dialog closing mid-drag, the tab hiding); without this the
                // knob and time readout would freeze while the film plays.
                onLostPointerCapture={() => { dragging.current = false; }}
              >
                <span className="smlp-film__fill" style={{ width: `${pct}%` }} />
                <span className="smlp-film__knob" style={{ left: `${pct}%` }} />
              </div>
              <span className="smlp-film__dur" aria-hidden="true">
                {duration ? formatTime(duration) : film.durationFallback}
              </span>
            </div>
            <div className="smlp-film__options">
              <button
                type="button"
                className="smlp-film__opt smlp-film__opt--rate"
                aria-label={fill(film.aria.speedTemplate, { rate: rateLabel })}
                onClick={cycleRate}
              >
                {rateLabel}
              </button>
              <button type="button" className="smlp-film__opt" onClick={toggleMute}>
                {muted ? film.soundOff : film.soundOn}
              </button>
              <button type="button" className="smlp-film__opt" onClick={toggleFullscreen}>
                {isFullscreen ? film.exitFullscreen : film.fullscreen}
              </button>
            </div>
          </div>
        </div>
      </div>
      <p role="status" className="smlp-sr">{open ? statusMessage : ''}</p>
    </dialog>
  );

  return createPortal(dialog, document.body);
}

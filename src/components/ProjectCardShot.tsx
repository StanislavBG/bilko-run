import { useEffect, useRef, useState } from 'react';

/**
 * Hero media for the active /projects card (.pr-shot): a muted, looping,
 * inline video when the card has one and motion is allowed, otherwise the
 * card's share image, otherwise the SCREENSHOT placeholder. In video mode a
 * Pause/Play button (and, when the clip has sound, Mute/Unmute) sits over the
 * video; under reduced motion or Save-Data a Play button over the poster mounts
 * the video only when pressed.
 */

export type CardShotMode = 'video' | 'image' | 'placeholder';

export function cardShotMode({ video, allowMotion, thumbnail, playRequested }: {
  video?: string;
  allowMotion: boolean;
  thumbnail?: string;
  playRequested?: boolean;
}): CardShotMode {
  if (video && (allowMotion || playRequested)) return 'video';
  return thumbnail ? 'image' : 'placeholder';
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function saveDataOn(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  return conn?.saveData === true;
}

function motionAllowedNow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia(REDUCED_MOTION).matches && !saveDataOn();
}

/**
 * False before mount (and on the server) so the first render shows the poster;
 * after mount, false under prefers-reduced-motion: reduce or Save-Data.
 * Re-renders when the reduced-motion media query changes.
 */
export function useAllowCardMotion(): boolean {
  const [allow, setAllow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(REDUCED_MOTION);
    const update = () => setAllow(motionAllowedNow());
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return allow;
}

const ICON = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const;

function PlayIcon() {
  return <svg {...ICON}><path d="M8 5v14l11-7z" /></svg>;
}

function PauseIcon() {
  return <svg {...ICON}><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>;
}

function MutedIcon() {
  return (
    <svg {...ICON}>
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg {...ICON}>
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ProjectCardShot({
  name, thumbnail, video, allowMotion, hasAudio, muted, paused, onMutedChange, onPausedChange,
}: {
  name: string;
  thumbnail?: string;
  video?: string;
  allowMotion: boolean;
  hasAudio?: boolean;
  muted: boolean;
  paused: boolean;
  onMutedChange: (next: boolean) => void;
  onPausedChange: (next: boolean) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  // Button labels follow the element's own play/pause/volumechange events.
  const [elPaused, setElPaused] = useState(paused);
  const [elMuted, setElMuted] = useState(muted);
  const playable = failed ? undefined : video;
  const mode = cardShotMode({ video: playable, allowMotion, thumbnail, playRequested });

  const onMutedRef = useRef(onMutedChange);
  onMutedRef.current = onMutedChange;

  useEffect(() => { setFailed(false); setPlayRequested(false); }, [video]);

  /** play(); if the browser refuses sound, mute, retry once and report muted. */
  const playEl = (el: HTMLVideoElement) => {
    const p = el.play();
    if (!p || typeof p.catch !== 'function') return;
    p.catch(() => {
      if (el.muted) return; // muted autoplay blocked: poster stays
      el.muted = true;
      onMutedRef.current(true);
      const retry = el.play();
      if (retry && typeof retry.catch === 'function') retry.catch(() => { /* still blocked */ });
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (mode !== 'video' || !el) return;
    // React does not reliably set the muted property; apply it on the element.
    el.muted = muted;
    setElMuted(el.muted);
    if (paused) {
      el.pause();
      setElPaused(true);
    } else {
      playEl(el);
    }
    // playEl reads callbacks through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, video, muted, paused]);

  const togglePaused = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      playEl(el);
      onPausedChange(false);
    } else {
      el.pause();
      onPausedChange(true);
    }
  };

  const toggleMuted = () => {
    const el = ref.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    onMutedChange(next);
  };

  const requestPlay = () => {
    setPlayRequested(true);
    onPausedChange(false);
  };

  return (
    <div className="pr-shot">
      {mode === 'video' ? (
        <>
          <video
            ref={ref}
            src={playable}
            poster={thumbnail}
            muted={muted}
            loop
            playsInline
            autoPlay={!paused}
            preload="auto"
            aria-label={name}
            onError={() => setFailed(true)}
            onPlay={() => setElPaused(false)}
            onPause={() => setElPaused(true)}
            onVolumeChange={e => setElMuted(e.currentTarget.muted)}
          />
          <div className="pr-shot-ctl">
            <button type="button" aria-label={elPaused ? 'Play video' : 'Pause video'} onClick={togglePaused}>
              {elPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
            {hasAudio && (
              <button type="button" aria-label={elMuted ? 'Unmute video' : 'Mute video'} onClick={toggleMuted}>
                {elMuted ? <MutedIcon /> : <SoundIcon />}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {mode === 'image' ? <img src={thumbnail} alt={name} /> : <span>SCREENSHOT</span>}
          {playable && !allowMotion && (
            <div className="pr-shot-ctl">
              <button type="button" aria-label="Play video" onClick={requestPlay}>
                <PlayIcon />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

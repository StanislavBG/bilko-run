import { useEffect, useRef, useState } from 'react';

/**
 * Hero media for the active /projects card (.pr-shot): a muted, looping,
 * inline video when the card has one and motion is allowed, otherwise the
 * card's share image, otherwise the SCREENSHOT placeholder.
 */

export type CardShotMode = 'video' | 'image' | 'placeholder';

export function cardShotMode({ video, allowMotion, thumbnail }: {
  video?: string;
  allowMotion: boolean;
  thumbnail?: string;
}): CardShotMode {
  if (video && allowMotion) return 'video';
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

export function ProjectCardShot({ name, thumbnail, video, allowMotion }: {
  name: string;
  thumbnail?: string;
  video?: string;
  allowMotion: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const mode = cardShotMode({ video: failed ? undefined : video, allowMotion, thumbnail });

  useEffect(() => { setFailed(false); }, [video]);

  useEffect(() => {
    const el = ref.current;
    if (mode !== 'video' || !el) return;
    // React does not emit the muted attribute; autoplay needs it set on the element.
    el.muted = true;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked: poster stays */ });
  }, [mode, video]);

  return (
    <div className="pr-shot">
      {mode === 'video' ? (
        <video
          ref={ref}
          src={video}
          poster={thumbnail}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-label={name}
          onError={() => setFailed(true)}
        />
      ) : mode === 'image' ? (
        <img src={thumbnail} alt={name} />
      ) : (
        <span>SCREENSHOT</span>
      )}
    </div>
  );
}

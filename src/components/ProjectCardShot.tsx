import { useEffect, useRef, useState } from 'react';

/**
 * Hero media for the active /projects card (.pr-shot): a looping, inline video
 * when the card has one and motion is allowed, otherwise the
 * card's share image, otherwise the SCREENSHOT placeholder. In video mode a
 * Pause/Play button (and, when the clip has sound, Mute/Unmute) sits over the
 * video; under reduced motion or Save-Data a Play button over the poster mounts
 * the video only when pressed. Hosted videos (not in the build) learn whether
 * they have sound from their <url>.json metadata, fetched once the video mounts.
 * The clip starts with sound when the browser allows it; otherwise it plays
 * muted until the visitor's first click, tap or key press on the page, without
 * changing the visitor's mute choice.
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

/** Resolved `audio` flags per metadata URL, plus in-flight requests (shared by every card). */
const audioMetaResolved = new Map<string, boolean>();
const audioMetaInFlight = new Map<string, Promise<boolean>>();

/** Test hook: forget every cached metadata result. */
export function resetAudioMetaCache(): void {
  audioMetaResolved.clear();
  audioMetaInFlight.clear();
}

/** True when the card should ask its hosted video's metadata whether it has sound. */
export function shouldFetchAudioMeta({ mode, audioMetaUrl, hasAudio }: {
  mode: CardShotMode;
  audioMetaUrl?: string;
  hasAudio?: boolean;
}): boolean {
  return mode === 'video' && !!audioMetaUrl && hasAudio !== true;
}

/**
 * Fetches `url` once (cached per URL) and resolves true only when the JSON has audio: true.
 * Errors and non-OK answers resolve false (cached); an abort resolves false without caching.
 */
export function loadAudioMeta(url: string, signal?: AbortSignal): Promise<boolean> {
  const known = audioMetaResolved.get(url);
  if (known !== undefined) return Promise.resolve(known);
  const pending = audioMetaInFlight.get(url);
  if (pending) return pending;
  const p = (async () => {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return false;
      const body = (await res.json()) as { audio?: unknown } | null;
      return body?.audio === true;
    } catch {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return false;
    }
  })().then(
    audio => {
      audioMetaResolved.set(url, audio);
      audioMetaInFlight.delete(url);
      return audio;
    },
    () => {
      audioMetaInFlight.delete(url);
      return false;
    },
  );
  audioMetaInFlight.set(url, p);
  return p;
}

/** The visitor's choice for the active card's video. */
export type CardPlayback = { muted: boolean; paused: boolean };

/** Sound on and playing until the visitor chooses otherwise. */
export const DEFAULT_CARD_PLAYBACK: CardPlayback = { muted: false, paused: false };

/** The part of a media element the sound helpers touch (an HTMLVideoElement fits). */
export type SoundMedia = { muted: boolean; play(): Promise<void> | undefined; pause(): void };

/** Compile-time proof that an HTMLVideoElement is a SoundMedia. */
export type VideoIsSoundMedia<T extends SoundMedia = HTMLVideoElement> = T;

/**
 * playing: played as asked. held: sound refused, playing muted instead.
 * blocked: refused even muted. interrupted: play() failed for another reason.
 */
export type PlayOutcome = 'playing' | 'held' | 'blocked' | 'interrupted';

function rejectionName(err: unknown): unknown {
  return (err as { name?: unknown } | null)?.name;
}

/**
 * Sets el.muted = wantMuted and calls play() synchronously (so a gesture handler
 * plays inside its gesture). When the browser refuses sound, mutes and retries
 * once. Never rejects.
 */
export function playWithSound(el: SoundMedia, wantMuted: boolean): Promise<PlayOutcome> {
  el.muted = wantMuted;
  let first: Promise<void> | undefined;
  try {
    first = el.play();
  } catch (err) {
    first = Promise.reject(err);
  }
  if (!first || typeof first.then !== 'function') return Promise.resolve('playing');
  return first.then(
    (): PlayOutcome => 'playing',
    async (err): Promise<PlayOutcome> => {
      if (rejectionName(err) !== 'NotAllowedError') return 'interrupted';
      if (el.muted) return 'blocked';
      el.muted = true;
      try {
        await el.play();
        return 'held';
      } catch {
        return 'blocked';
      }
    },
  );
}

/** Gestures that carry user activation; pointerdown is left out on purpose (see createCardSound). */
export const SOUND_GESTURE_EVENTS = ['pointerup', 'keydown', 'touchend', 'click'] as const;

export type CardSound = {
  apply(el: SoundMedia, choice: CardPlayback): void;
  held(): boolean;
  dispose(): void;
};

function defaultIsActive(): boolean {
  const ua = (globalThis.navigator as { userActivation?: { isActive: boolean } } | undefined)?.userActivation;
  return ua ? ua.isActive : true;
}

/**
 * Remembers the visitor's latest choice and, while the browser holds the sound
 * back, re-applies it at the first activating gesture on gestureTarget.
 * pointerdown is not listened to: touch pointerdown carries no activation (and
 * unmuting there pauses the clip), and a mouse press on a card switch would
 * start the old card's sound for the length of the press.
 */
export function createCardSound(opts: {
  gestureTarget: EventTarget;
  ignore?: (target: EventTarget | null) => boolean;
  isActive?: () => boolean;
  onHeldChange?: (held: boolean) => void;
}): CardSound {
  const isActive = opts.isActive ?? defaultIsActive;
  let lastEl: SoundMedia | null = null;
  let lastChoice: CardPlayback | null = null;
  let gen = 0;
  let held = false;
  let armed = false;

  const onGesture = (event: Event) => {
    if (opts.ignore?.(event.target)) return;
    if (!isActive()) return;
    if (lastEl && lastChoice) apply(lastEl, lastChoice);
  };

  const arm = (on: boolean) => {
    if (on === armed) return;
    armed = on;
    for (const name of SOUND_GESTURE_EVENTS) {
      if (on) opts.gestureTarget.addEventListener(name, onGesture, { capture: true, passive: true });
      else opts.gestureTarget.removeEventListener(name, onGesture, { capture: true });
    }
  };

  const setHeld = (next: boolean) => {
    if (next === held) return;
    held = next;
    arm(next);
    opts.onHeldChange?.(next);
  };

  function apply(el: SoundMedia, choice: CardPlayback): void {
    lastEl = el;
    lastChoice = choice;
    const mine = ++gen;
    if (choice.paused) {
      el.muted = choice.muted;
      el.pause();
      setHeld(false);
      return;
    }
    void playWithSound(el, choice.muted).then(outcome => {
      if (mine !== gen) return;
      if (outcome === 'playing') setHeld(false);
      else if ((outcome === 'held' || outcome === 'blocked') && !choice.muted) setHeld(true);
    });
  }

  return {
    apply,
    held: () => held,
    dispose: () => {
      gen++;
      arm(false);
    },
  };
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
  name, thumbnail, video, allowMotion, hasAudio, audioMetaUrl, muted, paused, onMutedChange, onPausedChange,
}: {
  name: string;
  thumbnail?: string;
  video?: string;
  allowMotion: boolean;
  hasAudio?: boolean;
  /** Hosted video metadata URL (<video url>.json); its `audio` flag shows Unmute when hasAudio is not set. */
  audioMetaUrl?: string;
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

  const [audioFromMeta, setAudioFromMeta] = useState(
    () => (audioMetaUrl ? audioMetaResolved.get(audioMetaUrl) === true : false),
  );
  const showMute = hasAudio === true || audioFromMeta;

  useEffect(() => {
    if (!audioMetaUrl || !shouldFetchAudioMeta({ mode, audioMetaUrl, hasAudio })) {
      setAudioFromMeta(audioMetaUrl ? audioMetaResolved.get(audioMetaUrl) === true : false);
      return;
    }
    const ctl = new AbortController();
    let live = true;
    loadAudioMeta(audioMetaUrl, ctl.signal).then(audio => { if (live) setAudioFromMeta(audio); });
    return () => { live = false; ctl.abort(); };
  }, [mode, audioMetaUrl, hasAudio]);

  useEffect(() => { setFailed(false); setPlayRequested(false); }, [video]);

  const ctlRef = useRef<HTMLDivElement>(null);
  const soundRef = useRef<CardSound | null>(null);
  /** Created on first use from effects and click handlers only (document is absent on the server). */
  const getSound = (): CardSound => {
    if (!soundRef.current) {
      soundRef.current = createCardSound({
        gestureTarget: document,
        // The controls' own clicks must not re-apply sound before their handler runs.
        ignore: t => t instanceof Node && !!ctlRef.current?.contains(t),
      });
    }
    return soundRef.current;
  };

  // Declared before the play/pause effect so its cleanup runs first.
  useEffect(() => () => {
    soundRef.current?.dispose();
    soundRef.current = null;
  }, [mode, video]);

  useEffect(() => {
    const el = ref.current;
    if (mode !== 'video' || !el) return;
    getSound().apply(el, { muted, paused });
    setElMuted(el.muted);
    if (paused) setElPaused(true);
    // getSound reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, video, muted, paused]);

  const togglePaused = () => {
    const el = ref.current;
    if (!el) return;
    const next = !el.paused;
    getSound().apply(el, { muted, paused: next });
    onPausedChange(next);
  };

  const toggleMuted = () => {
    const el = ref.current;
    if (!el) return;
    const next = !el.muted;
    getSound().apply(el, { muted: next, paused });
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
          <div className="pr-shot-ctl" ref={ctlRef}>
            <button type="button" aria-label={elPaused ? 'Play video' : 'Pause video'} onClick={togglePaused}>
              {elPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
            {showMute && (
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

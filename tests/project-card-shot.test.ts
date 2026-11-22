/** /projects hero media: muted looping video for the active card, poster image otherwise. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ProjectCardShot, cardShotMode, loadAudioMeta, resetAudioMetaCache, shouldFetchAudioMeta,
  playWithSound, createCardSound, SOUND_GESTURE_EVENTS, DEFAULT_CARD_PLAYBACK,
} from '../src/components/ProjectCardShot.js';

const VIDEO = '/projects/demo/tile.mp4?v=1a2b3c4d';
const THUMB = '/og/demo.png?v=deadbeef';

type Props = {
  name: string; thumbnail?: string; video?: string; allowMotion: boolean;
  hasAudio?: boolean; audioMetaUrl?: string; muted?: boolean; paused?: boolean;
};

function render(props: Props): string {
  return renderToStaticMarkup(createElement(ProjectCardShot, {
    muted: true,
    paused: false,
    onMutedChange: () => {},
    onPausedChange: () => {},
    ...props,
  }));
}

describe('ProjectCardShot', () => {
  it('starts with sound on by default', () => {
    expect(DEFAULT_CARD_PLAYBACK).toEqual({ muted: false, paused: false });
    const html = render({
      name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true, hasAudio: true,
      muted: DEFAULT_CARD_PLAYBACK.muted,
    });
    expect(html).toContain('aria-label="Mute video"');
    expect(html).not.toContain('Unmute video');
  });

  it('renders a video with poster and src when motion is allowed', () => {
    const html = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true });
    expect(html).toContain('<video');
    expect(html).toContain(`poster="${THUMB.replace(/&/g, '&amp;')}"`);
    expect(html).toContain(`src="${VIDEO}"`);
    expect(html).toContain('aria-label="Demo"');
    expect(html).not.toMatch(/<video[^>]*\scontrols/);
    expect(html).not.toContain('<img');
  });

  it('shows a Pause button while playing and a Play button when paused', () => {
    const playing = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true });
    expect(playing).toContain('class="pr-shot-ctl"');
    expect(playing).toContain('aria-label="Pause video"');
    expect(playing).toContain('type="button"');
    expect(playing).toContain('aria-hidden="true"');
    const paused = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true, paused: true });
    expect(paused).toContain('aria-label="Play video"');
    expect(paused).not.toContain('aria-label="Pause video"');
  });

  it('shows the Mute button only when the clip has audio, labelled by state', () => {
    const silent = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true });
    expect(silent).not.toContain('Unmute video');
    expect(silent).not.toContain('Mute video');
    const muted = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true, hasAudio: true });
    expect(muted).toContain('aria-label="Unmute video"');
    const loud = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true, hasAudio: true, muted: false });
    expect(loud).toContain('aria-label="Mute video"');
    expect(loud).not.toContain('Unmute video');
  });

  it('renders the poster plus a Play button, with no video, when motion is not allowed', () => {
    const html = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: false, hasAudio: true });
    expect(html).toContain('<img');
    expect(html).toContain(`src="${THUMB}"`);
    expect(html).toContain('aria-label="Play video"');
    expect(html).not.toContain('Mute video');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('tile.mp4');
  });

  it('renders the image with no buttons when there is no video', () => {
    const html = render({ name: 'Demo', thumbnail: THUMB, allowMotion: true, hasAudio: true });
    expect(html).toContain('<img');
    expect(html).toContain('alt="Demo"');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<button');
  });

  it('renders the SCREENSHOT placeholder when there is no thumbnail', () => {
    const html = render({ name: 'Demo', allowMotion: false });
    expect(html).toContain('SCREENSHOT');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<button');
  });
});

describe('cardShotMode', () => {
  it('covers every branch', () => {
    expect(cardShotMode({ video: VIDEO, allowMotion: true })).toBe('video');
    expect(cardShotMode({ video: VIDEO, allowMotion: false, thumbnail: THUMB })).toBe('image');
    expect(cardShotMode({ allowMotion: true, thumbnail: THUMB })).toBe('image');
    expect(cardShotMode({ allowMotion: true })).toBe('placeholder');
    expect(cardShotMode({ video: VIDEO, allowMotion: false })).toBe('placeholder');
  });

  it('switches to video when play is requested under reduced motion', () => {
    expect(cardShotMode({ video: VIDEO, allowMotion: false, thumbnail: THUMB, playRequested: true })).toBe('video');
    expect(cardShotMode({ video: VIDEO, allowMotion: false, playRequested: false, thumbnail: THUMB })).toBe('image');
    expect(cardShotMode({ allowMotion: false, thumbnail: THUMB, playRequested: true })).toBe('image');
  });
});

describe('ProjectCardShot hosted video audio (audioMetaUrl)', () => {
  const HOSTED = `/projects/demo/_media/${'a'.repeat(64)}.mp4`;
  const META = `${HOSTED}.json`;

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudioMetaCache();
  });

  function stubFetch(impl: () => Promise<unknown>) {
    const fn = vi.fn(impl);
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  const okJson = (body: unknown) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

  it('shows Unmute once the meta JSON says audio: true', async () => {
    const fetchFn = stubFetch(okJson({ bytes: 10, contentType: 'video/mp4', audio: true }));
    expect(render({ name: 'Demo', video: HOSTED, allowMotion: true, audioMetaUrl: META })).not.toContain('Unmute video');
    expect(await loadAudioMeta(META)).toBe(true);
    expect(await loadAudioMeta(META)).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(META);
    expect(render({ name: 'Demo', video: HOSTED, allowMotion: true, audioMetaUrl: META })).toContain('aria-label="Unmute video"');
  });

  it('shows no button when the meta says audio: false', async () => {
    stubFetch(okJson({ bytes: 10, contentType: 'video/mp4', audio: false }));
    expect(await loadAudioMeta(META)).toBe(false);
    expect(render({ name: 'Demo', video: HOSTED, allowMotion: true, audioMetaUrl: META })).not.toContain('Mute video');
  });

  it('shows no button when the fetch fails or answers non-OK', async () => {
    stubFetch(() => Promise.reject(new Error('offline')));
    expect(await loadAudioMeta(META)).toBe(false);
    expect(render({ name: 'Demo', video: HOSTED, allowMotion: true, audioMetaUrl: META })).not.toContain('Mute video');
    resetAudioMetaCache();
    stubFetch(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ audio: true }) }));
    expect(await loadAudioMeta(META)).toBe(false);
  });

  it('fetches only in video mode, with a meta URL, when hasAudio is not already true', () => {
    expect(shouldFetchAudioMeta({ mode: 'video', audioMetaUrl: META })).toBe(true);
    expect(shouldFetchAudioMeta({ mode: 'video', audioMetaUrl: META, hasAudio: false })).toBe(true);
    expect(shouldFetchAudioMeta({ mode: 'video', audioMetaUrl: META, hasAudio: true })).toBe(false);
    expect(shouldFetchAudioMeta({ mode: 'image', audioMetaUrl: META })).toBe(false);
    expect(shouldFetchAudioMeta({ mode: 'placeholder', audioMetaUrl: META })).toBe(false);
    expect(shouldFetchAudioMeta({ mode: 'video' })).toBe(false);
  });

  it('does not fetch while rendering a card with hasAudio or without a video', () => {
    const fetchFn = stubFetch(okJson({ audio: true }));
    expect(render({ name: 'Demo', video: HOSTED, allowMotion: true, hasAudio: true, audioMetaUrl: META })).toContain('Unmute video');
    expect(render({ name: 'Demo', thumbnail: THUMB, allowMotion: true, audioMetaUrl: META })).not.toContain('<button');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

type FakeMedia = {
  muted: boolean;
  calls: boolean[];
  pauses: number;
  results: Array<() => Promise<void> | undefined>;
  play(): Promise<void> | undefined;
  pause(): void;
};

function fakeMedia(results: Array<() => Promise<void> | undefined>, muted = false): FakeMedia {
  return {
    muted,
    calls: [],
    pauses: 0,
    results,
    play() { this.calls.push(this.muted); const next = this.results.shift(); return next ? next() : undefined; },
    pause() { this.pauses++; },
  };
}

const ok = () => Promise.resolve();
const refuse = () => Promise.reject(new DOMException('x', 'NotAllowedError'));
const abort = () => Promise.reject(new DOMException('x', 'AbortError'));
const settle = () => new Promise(r => setTimeout(r, 0));

describe('playWithSound', () => {
  it('resolves playing when play() resolves or returns undefined', async () => {
    const el = fakeMedia([ok]);
    expect(await playWithSound(el, false)).toBe('playing');
    expect(el.calls).toEqual([false]);
    const bare = fakeMedia([() => undefined], true);
    expect(await playWithSound(bare, false)).toBe('playing');
    expect(bare.calls).toEqual([false]);
  });

  it('calls play() synchronously with the wanted muted state', () => {
    const el = fakeMedia([ok]);
    void playWithSound(el, true);
    expect(el.calls).toEqual([true]);
  });

  it('retries muted after NotAllowedError and resolves held', async () => {
    const el = fakeMedia([refuse, ok]);
    expect(await playWithSound(el, false)).toBe('held');
    expect(el.calls).toEqual([false, true]);
    expect(el.muted).toBe(true);
  });

  it('resolves blocked when the muted retry is refused too', async () => {
    const el = fakeMedia([refuse, refuse]);
    expect(await playWithSound(el, false)).toBe('blocked');
    expect(el.calls).toEqual([false, true]);
  });

  it('resolves blocked on NotAllowedError while already muted, without a retry', async () => {
    const el = fakeMedia([refuse]);
    expect(await playWithSound(el, true)).toBe('blocked');
    expect(el.calls).toEqual([true]);
  });

  it('resolves interrupted on AbortError, muted unchanged, one call', async () => {
    const el = fakeMedia([abort]);
    expect(await playWithSound(el, false)).toBe('interrupted');
    expect(el.calls).toEqual([false]);
    expect(el.muted).toBe(false);
    const ns = fakeMedia([() => Promise.reject(new DOMException('x', 'NotSupportedError'))]);
    expect(await playWithSound(ns, false)).toBe('interrupted');
  });

  it('never rejects, even on a non-error rejection', async () => {
    const el = fakeMedia([() => Promise.reject(null)]);
    expect(await playWithSound(el, false)).toBe('interrupted');
  });
});

describe('createCardSound', () => {
  const SOUND = { muted: false, paused: false };

  function setup(extra: { ignore?: (t: EventTarget | null) => boolean; isActive?: () => boolean } = {}) {
    const target = new EventTarget();
    const changes: boolean[] = [];
    const sound = createCardSound({ gestureTarget: target, isActive: () => true, onHeldChange: h => changes.push(h), ...extra });
    return { target, changes, sound };
  }

  it('exports the gesture event list', () => {
    expect([...SOUND_GESTURE_EVENTS]).toEqual(['pointerup', 'keydown', 'touchend', 'click']);
  });

  it('stays not held when sound plays', async () => {
    const { sound, changes } = setup();
    const el = fakeMedia([ok]);
    sound.apply(el, SOUND);
    await settle();
    expect(sound.held()).toBe(false);
    expect(changes).toEqual([]);
  });

  it('holds on held, retries with sound on a click, then releases the listeners', async () => {
    const { sound, target, changes } = setup();
    const el = fakeMedia([refuse, ok, ok]);
    sound.apply(el, SOUND);
    await settle();
    expect(sound.held()).toBe(true);
    expect(changes).toEqual([true]);
    target.dispatchEvent(new Event('click'));
    expect(el.calls).toEqual([false, true, false]);
    await settle();
    expect(sound.held()).toBe(false);
    expect(changes).toEqual([true, false]);
    target.dispatchEvent(new Event('click'));
    target.dispatchEvent(new Event('keydown'));
    expect(el.calls).toHaveLength(3);
  });

  it('holds on blocked when sound was wanted, not when muted was wanted', async () => {
    const a = setup();
    a.sound.apply(fakeMedia([refuse, refuse]), SOUND);
    await settle();
    expect(a.sound.held()).toBe(true);
    const b = setup();
    b.sound.apply(fakeMedia([refuse]), { muted: true, paused: false });
    await settle();
    expect(b.sound.held()).toBe(false);
  });

  it('every gesture event name triggers the retry', async () => {
    for (const name of SOUND_GESTURE_EVENTS) {
      const { sound, target } = setup();
      const el = fakeMedia([refuse, ok, ok]);
      sound.apply(el, SOUND);
      await settle();
      target.dispatchEvent(new Event(name));
      expect(el.calls).toEqual([false, true, false]);
      sound.dispose();
    }
  });

  it('does not retry on events that are not gestures', async () => {
    const { sound, target } = setup();
    const el = fakeMedia([refuse, ok]);
    sound.apply(el, SOUND);
    await settle();
    target.dispatchEvent(new Event('pointerdown'));
    expect(el.calls).toHaveLength(2);
  });

  it('ignore and isActive false suppress the retry', async () => {
    const ig = setup({ ignore: () => true });
    const el1 = fakeMedia([refuse, ok]);
    ig.sound.apply(el1, SOUND);
    await settle();
    ig.target.dispatchEvent(new Event('click'));
    expect(el1.calls).toHaveLength(2);
    expect(ig.sound.held()).toBe(true);

    const ia = setup({ isActive: () => false });
    const el2 = fakeMedia([refuse, ok]);
    ia.sound.apply(el2, SOUND);
    await settle();
    ia.target.dispatchEvent(new Event('keydown'));
    expect(el2.calls).toHaveLength(2);
    expect(ia.sound.held()).toBe(true);
  });

  it('ignores a stale outcome from an older apply()', async () => {
    const { sound, changes } = setup();
    let rejectOld!: (e: unknown) => void;
    const old = fakeMedia([() => new Promise<void>((_, rej) => { rejectOld = rej; }), ok]);
    sound.apply(old, SOUND);
    const fresh = fakeMedia([ok]);
    sound.apply(fresh, SOUND);
    await settle();
    rejectOld(new DOMException('x', 'NotAllowedError'));
    await settle();
    expect(sound.held()).toBe(false);
    expect(changes).toEqual([]);
  });

  it('interrupted leaves held unchanged', async () => {
    const { sound } = setup();
    const el = fakeMedia([refuse, ok, abort]);
    sound.apply(el, SOUND);
    await settle();
    expect(sound.held()).toBe(true);
    sound.apply(el, SOUND);
    await settle();
    expect(sound.held()).toBe(true);
  });

  it('dispose() removes the listeners and is safe twice', async () => {
    const { sound, target } = setup();
    const el = fakeMedia([refuse, ok, ok]);
    sound.apply(el, SOUND);
    await settle();
    sound.dispose();
    sound.dispose();
    target.dispatchEvent(new Event('click'));
    expect(el.calls).toHaveLength(2);
  });

  it('a paused choice sets muted, calls pause() and clears held', async () => {
    const { sound, changes, target } = setup();
    const el = fakeMedia([refuse, ok]);
    sound.apply(el, SOUND);
    await settle();
    expect(sound.held()).toBe(true);
    sound.apply(el, { muted: false, paused: true });
    expect(el.pauses).toBe(1);
    expect(el.muted).toBe(false);
    expect(sound.held()).toBe(false);
    expect(changes).toEqual([true, false]);
    target.dispatchEvent(new Event('click'));
    expect(el.calls).toHaveLength(2);
  });

  it('default isActive uses navigator.userActivation when present', async () => {
    vi.stubGlobal('navigator', { userActivation: { isActive: false } });
    try {
      const target = new EventTarget();
      const sound = createCardSound({ gestureTarget: target });
      const el = fakeMedia([refuse, ok, ok]);
      sound.apply(el, SOUND);
      await settle();
      target.dispatchEvent(new Event('click'));
      expect(el.calls).toHaveLength(2);
      (globalThis.navigator as unknown as { userActivation: { isActive: boolean } }).userActivation.isActive = true;
      target.dispatchEvent(new Event('click'));
      expect(el.calls).toHaveLength(3);
      sound.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/** /projects hero media: muted looping video for the active card, poster image otherwise. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ProjectCardShot, cardShotMode, loadAudioMeta, resetAudioMetaCache, shouldFetchAudioMeta,
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

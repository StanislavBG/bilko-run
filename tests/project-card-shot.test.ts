/** /projects hero media: muted looping video for the active card, poster image otherwise. */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectCardShot, cardShotMode } from '../src/components/ProjectCardShot.js';

const VIDEO = '/projects/demo/tile.mp4?v=1a2b3c4d';
const THUMB = '/og/demo.png?v=deadbeef';

type Props = {
  name: string; thumbnail?: string; video?: string; allowMotion: boolean;
  hasAudio?: boolean; muted?: boolean; paused?: boolean;
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

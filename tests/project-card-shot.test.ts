/** /projects hero media: muted looping video for the active card, poster image otherwise. */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectCardShot, cardShotMode } from '../src/components/ProjectCardShot.js';

const VIDEO = '/projects/demo/tile.mp4?v=1a2b3c4d';
const THUMB = '/og/demo.png?v=deadbeef';

function render(props: { name: string; thumbnail?: string; video?: string; allowMotion: boolean }): string {
  return renderToStaticMarkup(createElement(ProjectCardShot, props));
}

describe('ProjectCardShot', () => {
  it('renders a video with poster and src when motion is allowed', () => {
    const html = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: true });
    expect(html).toContain('<video');
    expect(html).toContain(`poster="${THUMB.replace(/&/g, '&amp;')}"`);
    expect(html).toContain(`src="${VIDEO}"`);
    expect(html).toContain('aria-label="Demo"');
    expect(html).not.toContain('controls');
    expect(html).not.toContain('<img');
  });

  it('renders only the poster image when motion is not allowed', () => {
    const html = render({ name: 'Demo', thumbnail: THUMB, video: VIDEO, allowMotion: false });
    expect(html).toContain('<img');
    expect(html).toContain(`src="${THUMB}"`);
    expect(html).not.toContain('<video');
    expect(html).not.toContain('tile.mp4');
  });

  it('renders the image when there is no video', () => {
    const html = render({ name: 'Demo', thumbnail: THUMB, allowMotion: true });
    expect(html).toContain('<img');
    expect(html).toContain('alt="Demo"');
    expect(html).not.toContain('<video');
  });

  it('renders the SCREENSHOT placeholder when there is no thumbnail', () => {
    const html = render({ name: 'Demo', allowMotion: false });
    expect(html).toContain('SCREENSHOT');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<video');
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
});

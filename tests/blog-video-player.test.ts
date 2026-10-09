/** Blog video player: click-to-load poster, no iframe until play, strict URL allowlist. */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlogVideoPlayer, isSafeBlogVideoUrl } from '../src/components/BlogVideoPlayer.js';

describe('BlogVideoPlayer', () => {
  it('renders the poster and no iframe initially', () => {
    const html = renderToStaticMarkup(
      createElement(BlogVideoPlayer, { src: '/blog-videos/a-b-1/', title: 'My Post' }),
    );
    expect(html).toContain('Watch the 30-second version');
    expect(html).toContain('My Post');
    expect(html).not.toContain('<iframe');
  });

  it('accepts only same-origin /blog-videos/<slug>/ urls', () => {
    expect(isSafeBlogVideoUrl('/blog-videos/a-b-1/')).toBe(true);
    expect(isSafeBlogVideoUrl('https://evil.test/x/')).toBe(false);
    expect(isSafeBlogVideoUrl('/blog-videos/../x/')).toBe(false);
    expect(isSafeBlogVideoUrl('javascript:alert(1)')).toBe(false);
  });

  it('renders nothing for an unsafe src', () => {
    const html = renderToStaticMarkup(
      createElement(BlogVideoPlayer, { src: 'https://evil.test/x/', title: 'X' }),
    );
    expect(html).toBe('');
  });
});

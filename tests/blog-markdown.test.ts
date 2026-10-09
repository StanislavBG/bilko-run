import { describe, it, expect } from 'vitest';
import { parseFigure, splitInlineLinks } from '../src/lib/blogMarkdown.js';

describe('parseFigure', () => {
  it('parses a figure with a caption', () => {
    expect(parseFigure('![Dashboard](/blog-images/my-post/dash.png "Look at the green line")')).toEqual({
      src: '/blog-images/my-post/dash.png',
      alt: 'Dashboard',
      caption: 'Look at the green line',
    });
  });

  it('parses a figure without a caption', () => {
    expect(parseFigure('![Dashboard](/blog-images/my-post/dash.webp)')).toEqual({
      src: '/blog-images/my-post/dash.webp',
      alt: 'Dashboard',
      caption: '',
    });
  });

  it('rejects external URLs', () => {
    expect(parseFigure('![x](https://evil.com/a.png "c")')).toBeNull();
  });

  it('rejects path traversal', () => {
    expect(parseFigure('![x](/blog-images/../secret/a.png)')).toBeNull();
    expect(parseFigure('![x](/blog-images/post/../a.png)')).toBeNull();
  });

  it('rejects blocks that are not exactly one image', () => {
    expect(parseFigure('text ![x](/blog-images/p/a.png)')).toBeNull();
  });
});

describe('splitInlineLinks', () => {
  it('splits an https link', () => {
    expect(splitInlineLinks('[Repo](https://github.com/StanislavBG/bilko-run)')).toEqual([
      { type: 'link', text: 'Repo', href: 'https://github.com/StanislavBG/bilko-run' },
    ]);
  });

  it('links site paths', () => {
    expect(splitInlineLinks('Try [OutdoorHours](/projects/outdoor-hours) now')).toEqual([
      { type: 'text', value: 'Try ' },
      { type: 'link', text: 'OutdoorHours', href: '/projects/outdoor-hours' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('keeps unsafe hrefs as text', () => {
    for (const raw of ['[a](javascript:alert(1))', '[a](data:text/html,x)', '[a](//evil.com/x)']) {
      const out = splitInlineLinks(raw);
      expect(out.every(p => p.type === 'text')).toBe(true);
      expect(out.map(p => (p.type === 'text' ? p.value : '')).join('')).toBe(raw);
    }
  });

  it('handles multiple links with surrounding text', () => {
    const out = splitInlineLinks('a [one](https://a.com) b [two](/x) c');
    expect(out).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'link', text: 'one', href: 'https://a.com' },
      { type: 'text', value: ' b ' },
      { type: 'link', text: 'two', href: '/x' },
      { type: 'text', value: ' c' },
    ]);
  });
});

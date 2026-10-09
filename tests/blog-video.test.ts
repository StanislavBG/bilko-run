import { describe, expect, it } from 'vitest';
import { pickNextPost, validateBlogVideoHtml } from '../scripts/blog-video.js';

const VALID =
  '<!DOCTYPE html><html><head><meta name="sm-demo-duration" content="20"></head>' +
  '<body><script>const go = () => 1; go();</script></body></html>';

const withBody = (extra: string) => VALID.replace('</body>', `${extra}</body>`);

describe('validateBlogVideoHtml', () => {
  it('passes a minimal valid document', () => {
    expect(validateBlogVideoHtml(VALID)).toEqual({ ok: true, errors: [] });
  });

  it('rejects empty input', () => {
    const r = validateBlogVideoHtml('   ');
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/non-empty/);
  });

  it.each([
    ['fetch(', '<script>fetch("/x")</script>', /fetch\(/],
    ['<script src=', '<script src="a.js"></script>', /<script src>/],
    ['@import', '<style>@import "a.css";</style>', /@import/],
    ['top.', '<script>top.x = 1</script>', /top\.\/parent\./],
  ])('rejects %s', (_name, extra, msg) => {
    const r = validateBlogVideoHtml(withBody(extra));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(msg);
  });

  it('rejects a missing duration meta', () => {
    const r = validateBlogVideoHtml('<html><body>hi</body></html>');
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/sm-demo-duration/);
  });

  it('rejects duration 31', () => {
    const r = validateBlogVideoHtml(VALID.replace('content="20"', 'content="31"'));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/between 5 and 30, got 31/);
  });

  it('rejects documents over 2MB', () => {
    const r = validateBlogVideoHtml(withBody('<!--' + 'a'.repeat(2 * 1024 * 1024) + '-->'));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/byte limit/);
  });
});

describe('pickNextPost', () => {
  const now = new Date('2026-10-09T00:00:00.000Z');
  const posts = [
    { slug: 'old', publishedAt: '2026-10-01T00:00:00.000Z' },
    { slug: 'mid', publishedAt: '2026-10-05T00:00:00.000Z' },
    { slug: 'future', publishedAt: '2026-10-20T00:00:00.000Z' },
  ];

  it('returns the newest post without a video', () => {
    expect(pickNextPost(posts, () => false, now)?.slug).toBe('mid');
  });

  it('skips posts that have a video', () => {
    expect(pickNextPost(posts, (s) => s === 'mid', now)?.slug).toBe('old');
  });

  it('skips future-dated posts', () => {
    expect(pickNextPost(posts, () => false, now)?.slug).not.toBe('future');
  });

  it('returns null when all have video', () => {
    expect(pickNextPost(posts, () => true, now)).toBeNull();
  });
});

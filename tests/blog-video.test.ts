import { describe, expect, it } from 'vitest';
import { checkClaimsGrounded, pickNextPost, validateBlogVideoHtml } from '../scripts/blog-video.js';

const VALID =
  '<!DOCTYPE html><html><head><meta name="sm-demo-duration" content="20">' +
  '<meta name="blog-video-voice" content="af_heart"></head>' +
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

  const padded = (bytes: number) => {
    const base = withBody('<!---->');
    return withBody('<!--' + 'a'.repeat(bytes - Buffer.byteLength(base, 'utf8')) + '-->');
  };

  it('passes a ~3.9MB document', () => {
    expect(validateBlogVideoHtml(padded(Math.floor(3.9 * 1024 * 1024)))).toEqual({ ok: true, errors: [] });
  });

  it('rejects a ~4.1MB document', () => {
    const r = validateBlogVideoHtml(padded(Math.ceil(4.1 * 1024 * 1024)));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/byte limit/);
  });

  it('rejects a missing voice meta', () => {
    const r = validateBlogVideoHtml(VALID.replace('<meta name="blog-video-voice" content="af_heart">', ''));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/blog-video-voice/);
  });

  it('rejects an empty voice meta', () => {
    const r = validateBlogVideoHtml(VALID.replace('content="af_heart"', 'content="  "'));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/blog-video-voice/);
  });
});

describe('checkClaimsGrounded', () => {
  const post = [
    '---',
    'title: "Twelve Places, One Rule"',
    '---',
    '',
    'Every weather app tells you the temperature. [OutdoorHours](https://bilko.run/projects/outdoor-hours/)',
    'does   the    rest.',
  ].join('\n');
  const claims = (sources: string[]) =>
    '<script type="application/json" id="blog-video-claims">' +
    JSON.stringify(sources.map((source, i) => ({ sceneId: `s${i}`, source }))) +
    '</script>';

  it('passes a grounded claim', () => {
    expect(checkClaimsGrounded(claims(['Every weather app tells you the temperature.']), post)).toEqual([]);
  });

  it('passes a claim from the title', () => {
    expect(checkClaimsGrounded(claims(['Twelve Places, One Rule']), post)).toEqual([]);
  });

  it('fails a paraphrased claim', () => {
    const errors = checkClaimsGrounded(claims(['Weather apps only show the temperature.']), post);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/s0/);
  });

  it('passes a claim that matches only after link-stripping and whitespace collapse', () => {
    expect(checkClaimsGrounded(claims(['OutdoorHours does the rest.']), post)).toEqual([]);
  });

  it('fails a case-mismatched claim', () => {
    expect(checkClaimsGrounded(claims(['every weather app tells you the temperature.']), post)).toHaveLength(1);
  });

  it('errors when the claims block is missing', () => {
    expect(checkClaimsGrounded(VALID, post).join('\n')).toMatch(/blog-video-claims/);
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

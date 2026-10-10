import { describe, expect, it } from 'vitest';
import { validateBlogVideoHtml } from '../scripts/blog-video.js';
import {
  FOCUS_TRANSFORM_SRC,
  focusTransform,
  renderVideoHtml,
  type Rect,
  type ResolvedSpec,
} from '../scripts/blog-video-runtime.js';

// 1x1 jpeg
const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const spec: ResolvedSpec = {
  slug: 'demo-post',
  title: 'A Demo <Post> & More',
  projectName: 'DemoApp',
  projectUrl: 'https://bilko.run/projects/demo/',
  voice: 'af_heart',
  durationS: 20,
  scenes: [
    { id: 's0', type: 'title', start: 0, duration: 4, caption: 'Caption zero', asset: { kind: 'image', dataUri: JPEG } },
    { id: 's1', type: 'text', start: 4, duration: 4, caption: 'Caption one says "hi"' },
    {
      id: 's2', type: 'screen', start: 8, duration: 8, caption: 'Caption two',
      callout: 'Look <here>', focus: { x: 200, y: 100, w: 400, h: 120 }, asset: { kind: 'image', dataUri: JPEG },
    },
    { id: 's3', type: 'closing', start: 16, duration: 4, caption: 'Caption three', asset: { kind: 'image', dataUri: JPEG } },
  ],
  claims: [{ sceneId: 's2', source: 'blog para 2' }],
};

describe('focusTransform', () => {
  it('is identity at progress 0', () => {
    expect(focusTransform({ x: 300, y: 200, w: 100, h: 80 }, 0)).toEqual({ scale: 1, tx: 0, ty: 0 });
  });

  const rects: Record<string, Rect> = {
    topLeft: { x: 40, y: 30, w: 200, h: 100 },
    topRight: { x: 1040, y: 30, w: 200, h: 100 },
    bottomLeft: { x: 40, y: 590, w: 200, h: 100 },
    bottomRight: { x: 1040, y: 590, w: 200, h: 100 },
    centre: { x: 540, y: 310, w: 200, h: 100 },
  };
  for (const [name, r] of Object.entries(rects)) {
    it(`keeps the padded rect inside the stage at progress 1 (${name})`, () => {
      const { scale, tx, ty } = focusTransform(r, 1);
      expect(scale).toBeGreaterThanOrEqual(1);
      const l = (r.x - r.w * 0.08) * scale + tx;
      const t = (r.y - r.h * 0.08) * scale + ty;
      const rr = (r.x + r.w * 1.08) * scale + tx;
      const b = (r.y + r.h * 1.08) * scale + ty;
      expect(l).toBeGreaterThanOrEqual(-1e-6);
      expect(t).toBeGreaterThanOrEqual(-1e-6);
      expect(rr).toBeLessThanOrEqual(1280 + 1e-6);
      expect(b).toBeLessThanOrEqual(720 + 1e-6);
      // image edge never enters the stage
      expect(tx).toBeLessThanOrEqual(0);
      expect(ty).toBeLessThanOrEqual(0);
      expect(1280 * scale + tx).toBeGreaterThanOrEqual(1280 - 1e-6);
      expect(720 * scale + ty).toBeGreaterThanOrEqual(720 - 1e-6);
    });
  }

  it('emitted runtime source agrees with the TS function', () => {
    const emitted = new Function(`return ${FOCUS_TRANSFORM_SRC}`)() as typeof focusTransform;
    for (const [r, p] of [
      [rects.centre, 0.3],
      [rects.topLeft, 0.8],
      [rects.bottomRight, 1],
    ] as const) {
      const a = focusTransform(r, p);
      const b = emitted(r, p);
      expect(b.scale).toBeCloseTo(a.scale, 9);
      expect(b.tx).toBeCloseTo(a.tx, 9);
      expect(b.ty).toBeCloseTo(a.ty, 9);
    }
  });
});

describe('renderVideoHtml', () => {
  const html = renderVideoHtml(spec);

  it('passes the validator except for size', () => {
    const { errors } = validateBlogVideoHtml(html);
    expect(errors.filter((e) => !e.includes('-byte limit'))).toEqual([]);
  });

  it('contains captions, meta tags and claims JSON', () => {
    expect(html).toContain('Caption zero');
    expect(html).toContain('Caption one says &quot;hi&quot;');
    expect(html).toContain('Caption two');
    expect(html).toContain('Caption three');
    expect(html).toContain('<meta name="sm-demo-duration" content="20">');
    expect(html).toContain('<meta name="blog-video-voice" content="af_heart">');
    const m = html.match(/<script type="application\/json" id="blog-video-claims">([\s\S]*?)<\/script>/);
    expect(JSON.parse(m![1])).toEqual(spec.claims);
    expect(html).toContain('A Demo &lt;Post&gt; &amp; More');
  });

  describe('closing scene URL', () => {
    const closing = (projectUrl: string, caption: string): string => {
      const scenes = spec.scenes.map((s) => (s.type === 'closing' ? { ...s, caption } : s));
      return renderVideoHtml({ ...spec, projectUrl, scenes });
    };
    const linkDiv = (h: string): string => h.match(/<div class="link in"[^>]*>[^<]*<\/div>/)![0];

    it('uses nowrap and never break-all on .link', () => {
      expect(html).toMatch(/\.link\{[^}]*white-space:nowrap/);
      expect(html).not.toContain('word-break:break-all');
    });

    it('shrinks the font for a 45-char URL and drops the scheme', () => {
      const url = 'https://bilko.run/projects/outdoor-hours-xyz/';
      const link = linkDiv(closing(url, 'Something else'));
      const px = Number(link.match(/font-size:(\d+)px/)![1]);
      expect(px).toBeLessThan(58);
      expect(link).toContain('>bilko.run/projects/outdoor-hours-xyz/<');
      expect(link).not.toContain('https://');
    });

    it('does not render the caption again when it equals the URL', () => {
      const h = closing('https://bilko.run/projects/demo/', 'bilko.run/projects/demo');
      const count = h.split('bilko.run/projects/demo').length - 1;
      expect(count).toBe(1);
    });

    it('still renders a different caption', () => {
      const h = closing('https://bilko.run/projects/demo/', 'Go try it today');
      expect(h).toContain('Go try it today');
    });
  });

  it('exposes smDemo and has no function token', () => {
    expect(html).toContain('window.smDemo');
    expect(html).not.toMatch(/function/i);
  });
});

import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { fontFiles, renderOgCard } from '../server/og-image';

const icon = (fill: string) =>
  Buffer.from(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${fill}"/></svg>`).render().asPng());

const base = { title: 'Page Roast', tagline: 'Brutally honest landing page audits', category: 'Tool', urlLabel: 'bilko.run/projects/page-roast' };

describe('renderOgCard', () => {
  it('returns a 1200x630 PNG', () => {
    const png = renderOgCard(base);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('escapes hostile text', () => {
    expect(() => renderOgCard({ ...base, tagline: '<script>alert("x")</script> & more' })).not.toThrow();
  });

  it('handles a 400-char tagline and a very long title', () => {
    const png = renderOgCard({ ...base, title: 'W'.repeat(120), tagline: 'word '.repeat(80).slice(0, 400) });
    expect(png.readUInt32BE(16)).toBe(1200);
  });

  it('memoizes identical input', () => {
    expect(renderOgCard({ ...base })).toBe(renderOgCard({ ...base }));
  });

  it('draws the icon, and different icons give different cards', () => {
    const none = renderOgCard(base);
    const red = renderOgCard({ ...base, iconPng: icon('#ff0000') });
    const blue = renderOgCard({ ...base, iconPng: icon('#0000ff') });
    expect(red.equals(none)).toBe(false);
    expect(red.equals(blue)).toBe(false);
    expect(red.readUInt32BE(16)).toBe(1200);
  });

  it('draws CJK glyphs from the fallback font', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#000"/><text x="20" y="150" font-weight="700" font-size="110" font-family="DejaVu Sans" fill="#fff">三風</text></svg>`;
    const brightPixels = (files: string[]) => {
      const img = new Resvg(svg, { font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' } }).render();
      const px = img.pixels;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] > 128) n++;
      return n;
    };
    const all = fontFiles();
    const dejavuOnly = all.filter((f) => /DejaVuSans(-Bold)?\.ttf$/.test(f));
    expect(dejavuOnly).toHaveLength(2);
    expect(brightPixels(all)).toBeGreaterThanOrEqual(1.5 * brightPixels(dejavuOnly));
  });
});

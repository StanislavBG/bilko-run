import { describe, expect, it } from 'vitest';
import { renderOgCard } from '../server/og-image';

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
});

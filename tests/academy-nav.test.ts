import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../src/data/portfolio.js';

describe('academy nav removal', () => {
  it('has no academy section', () => {
    for (const s of SECTIONS) {
      expect(s.id).not.toBe('academy');
      expect(s.path.includes('academy')).toBe(false);
      if (s.href) expect(s.href.includes('academy')).toBe(false);
    }
  });

  it('keeps the remaining sections in order', () => {
    expect(SECTIONS.map(s => s.id)).toEqual(['home', 'projects', 'blog', 'workflows', 'contact']);
  });
});

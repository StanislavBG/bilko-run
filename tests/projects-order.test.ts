import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HUB_CARDS, PUBLIC_CARDS } from '../src/data/projectsView.js';
import commitCounts from '../src/data/commit-counts.json' with { type: 'json' };

const COMMIT_COUNTS = commitCounts as Record<string, number>;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS_PAGE = resolve(ROOT, 'src/pages/ProjectsPage.tsx');

describe('/projects hub ordering', () => {
  it('HUB_CARDS is non-increasing by commit-counts.json value (0 for missing)', () => {
    for (let i = 1; i < HUB_CARDS.length; i++) {
      const prevCount = COMMIT_COUNTS[HUB_CARDS[i - 1].slug] ?? 0;
      const count = COMMIT_COUNTS[HUB_CARDS[i].slug] ?? 0;
      expect(prevCount, `card ${i - 1} (${HUB_CARDS[i - 1].slug}) < card ${i} (${HUB_CARDS[i].slug})`).toBeGreaterThanOrEqual(count);
    }
  });

  it('PUBLIC_CARDS includes the academy card', () => {
    expect(PUBLIC_CARDS.some(c => c.slug === 'academy')).toBe(true);
  });

  it('ProjectsPage.tsx never references commit-counts/commitCount', () => {
    const src = readFileSync(PROJECTS_PAGE, 'utf8');
    expect(src).not.toContain('commit-counts');
    expect(src).not.toContain('commitCount');
  });
});

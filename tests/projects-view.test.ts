// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PUBLIC_CARDS, HUB_CARDS } from '../src/data/projectsView';

// Captured from the pre-change code (hardcoded PUBLIC_SLUGS / DISPLAY_NAME).
const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  ['session-manager', 'Session Manager'],
  ['social-signals-trader', 'Social Signals Trader'],
  ['escape-velocity', 'Escape Velocity'],
  ['academy', 'Academy'],
  ['git-viewer', 'Git Viewer'],
  ['launch-kit', 'Launch Kit'],
  ['outdoor-hours', 'Weather'],
];

describe('projectsView public cards', () => {
  it('renders the same public slugs, order, and names as before the registry wiring', () => {
    expect(PUBLIC_CARDS.map(c => [c.slug, c.name])).toEqual(EXPECTED);
  });
});

describe('projectsView listing-driven enrichment', () => {
  const byslug = (s: string) => HUB_CARDS.find(c => c.slug === s);

  it('git-viewer and launch-kit carry the same metric/detail as the former ENRICH map', () => {
    const gv = byslug('git-viewer');
    expect(gv?.metric).toBe('12 repos');
    expect(gv?.metricLabel).toBe('indexed');
    expect(gv?.lang).toBe('TypeScript');
    expect(gv?.detail).toBe('Pulls every public repo, scores it by recency and activity, and renders a living portfolio. No manual upkeep — push code, the dashboard updates itself.');
    const lk = byslug('launch-kit');
    expect(lk?.metric).toBe('8 skills');
    expect(lk?.metricLabel).toBe('$9 one-time');
    expect(lk?.lang).toBe('Markdown');
    expect(lk?.detail).toBe('Eight Claude skills that run your launch from one shared context file: page roast, headlines, pricing, launch emails, launch week, build-in-public posts, first 100 customers. Each writes one file and names the next skill to fire.');
  });

  it('a project with no listing has metric/detail undefined', () => {
    const bare = HUB_CARDS.find(c => c.type === 'project' && c.slug === 'academy');
    expect(bare).toBeDefined();
    expect(bare?.metric).toBeUndefined();
    expect(bare?.detail).toBeUndefined();
  });
});

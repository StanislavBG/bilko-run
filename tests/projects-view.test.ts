// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PUBLIC_CARDS, HUB_CARDS } from '../src/data/projectsView';
import { PROJECTS } from '../src/data/projectsRegistry';
import { projectMetadataRows } from '../src/data/projectMetadata';
import { ListingSchema } from '../mcp-host-server/src/contract/registry';

// Captured from the pre-change code (hardcoded PUBLIC_SLUGS / DISPLAY_NAME).
const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  ['session-manager', 'Session Manager'],
  ['social-signals-trader', 'Social Signals Trader'],
  ['escape-velocity', 'Escape Velocity'],
  ['academy', 'Academy'],
  ['git-viewer', 'Git Viewer'],
  ['game-academy', 'Bilko Game Academy'],
  ['launch-kit', 'Launch Kit'],
  ['outdoor-hours', 'Weather'],
  ['family-frame', 'Family Frame'],
];

describe('projectsView public cards', () => {
  it('renders the same public slugs, order, and names as before the registry wiring', () => {
    expect(PUBLIC_CARDS.map(c => [c.slug, c.name])).toEqual(EXPECTED);
  });
});

describe('projectsView share-card thumbnails', () => {
  it('every project card uses its /og share card; packages have none', () => {
    for (const c of HUB_CARDS) {
      if (c.type === 'project') expect(c.thumbnail).toBe(`/og/${c.slug}.png`);
      if (c.type === 'package') expect(c.thumbnail).toBeUndefined();
    }
  });
});

describe('projectsView listing-driven enrichment', () => {
  const byslug = (s: string) => HUB_CARDS.find(c => c.slug === s);

  it('git-viewer and launch-kit cards carry metric/detail from their registry listing', () => {
    for (const slug of ['git-viewer', 'launch-kit']) {
      const p = PROJECTS.find(x => x.slug === slug)!;
      const card = byslug(slug);
      expect(card, slug).toBeDefined();
      // launch-kit's listing currently carries no metric/detail; only git-viewer proves enrichment.
      if (slug === 'git-viewer') {
        expect(p.listing?.metric, `${slug} metric`).toBeDefined();
        expect(p.listing?.detail, `${slug} detail`).toBeDefined();
      }
      expect(card?.metric).toBe(p.listing?.metric);
      expect(card?.metricLabel).toBe(p.listing?.metricLabel);
      expect(card?.lang).toBe(p.listing?.lang);
      expect(card?.detail).toBe(p.listing?.detail);
    }
  });

  it('a project with no listing has metric/detail undefined', () => {
    const bare = HUB_CARDS.find(c => c.type === 'project' && c.slug === 'academy');
    expect(bare).toBeDefined();
    expect(bare?.metric).toBeUndefined();
    expect(bare?.detail).toBeUndefined();
  });
});

describe('projectMetadataRows', () => {
  it('lists every listing key for git-viewer and flags absent offering as missing', () => {
    const gv = PROJECTS.find(p => p.slug === 'git-viewer')!;
    const rows = projectMetadataRows(gv);
    const byKey = new Map(rows.map(r => [r.key, r]));
    for (const k of ListingSchema.keyof().options) {
      expect(byKey.has(`listing.${k}`), `listing.${k}`).toBe(true);
    }
    if (gv.listing?.offering === undefined) {
      expect(byKey.get('listing.offering')).toEqual({ key: 'listing.offering', value: '', missing: true });
    }
    expect(byKey.get('slug')?.value).toBe('git-viewer');
  });

  it('marks listing.offering missing when absent', () => {
    const base = PROJECTS[0];
    const rows = projectMetadataRows({ ...base, listing: { ...base.listing, offering: undefined } });
    expect(rows.find(r => r.key === 'listing.offering')?.missing).toBe(true);
  });
});

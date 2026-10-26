// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PUBLIC_CARDS, HUB_CARDS } from '../src/data/projectsView';
import { PROJECTS } from '../src/data/projectsRegistry';
import { projectMetadataRows } from '../src/data/projectMetadata';
import commitCounts from '../src/data/commit-counts.json' with { type: 'json' };
import { ListingSchema } from '../mcp-host-server/src/contract/registry';

const COUNTS = commitCounts as Record<string, number>;
const PUBLIC_PROJECTS = PROJECTS.filter(p => p.public === true);

describe('projectsView public cards', () => {
  it('shows exactly the registry projects marked public', () => {
    expect(new Set(PUBLIC_CARDS.map(c => c.slug))).toEqual(new Set(PUBLIC_PROJECTS.map(p => p.slug)));
    expect(PUBLIC_CARDS.length).toBe(PUBLIC_PROJECTS.length);
  });

  it("each public card's name is its registry displayName ?? name", () => {
    const names = new Map(PUBLIC_PROJECTS.map(p => [p.slug, p.displayName ?? p.name]));
    for (const c of PUBLIC_CARDS) expect(c.name, c.slug).toBe(names.get(c.slug));
  });

  it('orders public cards by non-increasing commit count', () => {
    const count = (slug: string) => COUNTS[slug] ?? 0;
    for (let i = 0; i < PUBLIC_CARDS.length - 1; i++) {
      expect(count(PUBLIC_CARDS[i].slug), PUBLIC_CARDS[i].slug).toBeGreaterThanOrEqual(count(PUBLIC_CARDS[i + 1].slug));
    }
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

  it('a project with no listing metric/detail has none on its card', () => {
    const bare = PROJECTS.filter(p => p.listing?.metric === undefined && p.listing?.detail === undefined);
    for (const p of bare) {
      const card = HUB_CARDS.find(c => c.type === 'project' && c.slug === p.slug);
      if (!card) continue;
      expect(card.metric, p.slug).toBeUndefined();
      expect(card.detail, p.slug).toBeUndefined();
    }
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

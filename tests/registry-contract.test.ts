import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  SlugSchema,
  RegistrySchema,
  RegistryProjectSchema,
  ProjectStatusSchema,
} from '../mcp-host-server/src/contract/registry.js';

const ROOT = resolve(__dirname, '..');
const REGISTRY_JSON = resolve(ROOT, 'src/data/standalone-projects.json');

function readRegistry(): unknown {
  return JSON.parse(readFileSync(REGISTRY_JSON, 'utf-8'));
}

const BASE_ENTRY = {
  slug: 'foo-bar',
  name: 'Foo Bar',
  tagline: 'A test project',
  category: 'Data',
  status: 'live' as const,
  year: 2026,
  host: { kind: 'static-path' as const, path: '/projects/foo-bar/' },
};

describe('RegistrySchema against the real registry', () => {
  it('parses src/data/standalone-projects.json successfully', () => {
    const result = RegistrySchema.safeParse(readRegistry());
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});

describe('SlugSchema', () => {
  it.each([
    'a-b',
    'outdoor-hours',
    'git-viewer',
    'x'.repeat(40),
  ])('accepts valid slug %s', (slug) => {
    expect(SlugSchema.safeParse(slug).success).toBe(true);
  });

  it.each([
    ['..', 'dots'],
    ['a', 'too short'],
    ['Foo', 'uppercase'],
    ['-x', 'leading hyphen'],
    ['x-', 'trailing hyphen'],
    ['a/b', 'slash'],
    ['x'.repeat(41), 'too long'],
  ])('rejects invalid slug %s (%s)', (slug) => {
    expect(SlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe('ProjectStatusSchema', () => {
  it.each(['live', 'cooking', 'postponed', 'archived'])('accepts %s', (status) => {
    expect(ProjectStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects unknown status', () => {
    expect(ProjectStatusSchema.safeParse('deprecated').success).toBe(false);
  });
});

describe('RegistryProjectSchema optional fields', () => {
  it('allows optional launchedAt, tags, thumbnail', () => {
    const result = RegistryProjectSchema.safeParse({
      ...BASE_ENTRY,
      launchedAt: '2026-01-01',
      tags: ['Free', 'Browser'],
      thumbnail: '/thumb.png',
    });
    expect(result.success).toBe(true);
  });

  it('allows an entry with none of the optional fields', () => {
    expect(RegistryProjectSchema.safeParse(BASE_ENTRY).success).toBe(true);
  });

  it('accepts public:true with a displayName', () => {
    const result = RegistryProjectSchema.safeParse({
      ...BASE_ENTRY,
      public: true,
      displayName: 'Foo Bar Pro',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty displayName', () => {
    expect(RegistryProjectSchema.safeParse({ ...BASE_ENTRY, displayName: '' }).success).toBe(false);
  });

  it('rejects a displayName longer than 60 chars', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, displayName: 'x'.repeat(61) }).success
    ).toBe(false);
  });

  it('rejects a non-boolean public', () => {
    expect(RegistryProjectSchema.safeParse({ ...BASE_ENTRY, public: 'yes' }).success).toBe(false);
  });
});

describe('listing and content standards', () => {
  const VALID_LISTING = {
    detail: 'A short story about the project.',
    metric: '12k',
    metricLabel: 'users',
    lang: 'TypeScript',
    audience: 'Solo builders',
    talkingPoints: ['Fast', 'Free'],
  };

  it('parses a valid listing', () => {
    const result = RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing: VALID_LISTING });
    expect(result.success).toBe(true);
  });

  it('rejects a tagline over 160 chars', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, tagline: 'x'.repeat(161) }).success
    ).toBe(false);
  });

  it('rejects more than 6 tags', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
        .success
    ).toBe(false);
  });

  it('rejects more than 5 talking points', () => {
    const talkingPoints = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing: { talkingPoints } }).success
    ).toBe(false);
  });

  it('rejects a listing detail over 400 chars', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing: { detail: 'x'.repeat(401) } })
        .success
    ).toBe(false);
  });

  it('rejects an unknown listing key', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing: { nope: 'x' } }).success
    ).toBe(false);
  });

  it('rejects a ContentGrade mention in listing.detail, naming slug and field', () => {
    const result = RegistrySchema.safeParse([
      { ...BASE_ENTRY, listing: { detail: 'Built on Content-Grade tech' } },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('\n');
      expect(msg).toContain('foo-bar');
      expect(msg).toContain('listing.detail');
    }
  });

  it('rejects a ContentGrade mention in the tagline', () => {
    expect(
      RegistrySchema.safeParse([{ ...BASE_ENTRY, tagline: 'powered by contentgrade' }]).success
    ).toBe(false);
  });

  it('parses the marketing listing fields', () => {
    const listing = {
      offering: 'showcase',
      pricing: 'none',
      callToAction: 'Open the portfolio',
      avoidClaims: ['Not a SaaS'],
    };
    const result = RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.listing).toEqual(listing);
  });

  it('rejects an unknown offering', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing: { offering: 'startup' } }).success
    ).toBe(false);
  });

  it('rejects a callToAction over 120 chars', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing: { callToAction: 'x'.repeat(121) } })
        .success
    ).toBe(false);
  });

  it('rejects more than 5 avoidClaims', () => {
    const avoidClaims = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, listing: { avoidClaims } }).success
    ).toBe(false);
  });

  it('rejects a ContentGrade mention in avoidClaims, naming slug and field', () => {
    const result = RegistrySchema.safeParse([
      { ...BASE_ENTRY, listing: { avoidClaims: ['fine', 'Do not say ContentGrade'] } },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('\n');
      expect(msg).toContain('foo-bar');
      expect(msg).toContain('listing.avoidClaims[1]');
    }
  });

  it('rejects an http thumbnail', () => {
    expect(
      RegistryProjectSchema.safeParse({ ...BASE_ENTRY, thumbnail: 'http://x' }).success
    ).toBe(false);
  });
});

describe('RegistrySchema rejection cases', () => {
  it('rejects a duplicate slug', () => {
    const result = RegistrySchema.safeParse([BASE_ENTRY, BASE_ENTRY]);
    expect(result.success).toBe(false);
  });

  it('rejects a static-path entry whose host.path does not match /projects/<slug>/', () => {
    const result = RegistrySchema.safeParse([
      { ...BASE_ENTRY, host: { kind: 'static-path', path: '/projects/wrong-slug/' } },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects an external-url host whose url is not https', () => {
    const result = RegistrySchema.safeParse([
      {
        ...BASE_ENTRY,
        host: { kind: 'external-url', url: 'http://example.com' },
      },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects an entry with an unknown top-level key', () => {
    const result = RegistrySchema.safeParse([{ ...BASE_ENTRY, unknownKey: 'nope' }]);
    expect(result.success).toBe(false);
  });
});

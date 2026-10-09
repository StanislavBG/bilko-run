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

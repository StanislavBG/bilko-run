import { describe, it, expect } from 'vitest';
import os from 'node:os';
import { updateListingInRegistry, buildRegistration } from '../mcp-host-server/src/listing-tool.js';
import { RegistrySchema, type RegistryProject } from '../mcp-host-server/src/contract/registry.js';

const OWNER = '/tmp/listing-tool-owner-repo';

function registry(): RegistryProject[] {
  return RegistrySchema.parse([
    {
      slug: 'demo',
      name: 'Demo',
      tagline: 'Old tagline',
      category: 'Game',
      status: 'live',
      year: 2026,
      host: { kind: 'static-path', path: '/projects/demo/', localPath: OWNER },
    },
    {
      slug: 'other',
      name: 'Other',
      tagline: 'Other tagline',
      category: 'Game',
      status: 'live',
      year: 2026,
      host: { kind: 'static-path', path: '/projects/other/', localPath: '/tmp/listing-tool-other-repo' },
    },
  ]);
}

describe('updateListingInRegistry', () => {
  it('lets the owner update tagline and listing', () => {
    const { next, changed } = updateListingInRegistry(registry(), 'demo', OWNER, {
      tagline: 'New tagline',
      listing: { detail: 'The story', metric: '42', metricLabel: 'plays' },
    });
    expect(changed).toBe(true);
    const demo = next.find((p) => p.slug === 'demo')!;
    expect(demo.tagline).toBe('New tagline');
    expect(demo.listing?.detail).toBe('The story');
    expect(next.find((p) => p.slug === 'other')!.tagline).toBe('Other tagline');
    expect(() => RegistrySchema.parse(next)).not.toThrow();
  });

  it('rejects a caller from another repo path', () => {
    expect(() => updateListingInRegistry(registry(), 'demo', '/tmp/listing-tool-other-repo', { tagline: 'x' })).toThrow(/owned by/);
  });

  it('rejects public in the patch', () => {
    expect(() => updateListingInRegistry(registry(), 'demo', OWNER, { public: true })).toThrow(/not owned/);
  });

  it('rejects an unknown slug', () => {
    expect(() => updateListingInRegistry(registry(), 'nope', OWNER, { tagline: 'x' })).toThrow(/not found/);
  });

  it('returns changed=false for an identical patch', () => {
    const { changed, next } = updateListingInRegistry(registry(), 'demo', OWNER, { tagline: 'Old tagline' });
    expect(changed).toBe(false);
    expect(next).toEqual(registry());
  });
});

describe('buildRegistration', () => {
  const base = { slug: 'fresh', name: 'Fresh', tagline: 'T', category: 'Game', status: 'live' as const, year: 2026 };

  it('builds an admin-only entry (no public key)', () => {
    const entry = buildRegistration(registry(), { ...base, callerRepoPath: '/tmp/listing-tool-fresh-repo' });
    expect('public' in entry).toBe(false);
    expect(entry.host.localPath).toBe('/tmp/listing-tool-fresh-repo');
  });

  it('collapses the home dir to ~', () => {
    const entry = buildRegistration(registry(), { ...base, callerRepoPath: `${os.homedir()}/Projects/Fresh` });
    expect(entry.host.localPath).toBe('~/Projects/Fresh');
  });

  it('refuses a duplicate slug', () => {
    expect(() => buildRegistration(registry(), { ...base, slug: 'demo', callerRepoPath: '/tmp/listing-tool-fresh-repo' })).toThrow(/already registered/);
  });

  it('refuses a repo already bound to another slug', () => {
    expect(() => buildRegistration(registry(), { ...base, callerRepoPath: OWNER })).toThrow(/already bound/);
  });
});

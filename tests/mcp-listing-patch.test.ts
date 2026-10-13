import { describe, it, expect } from 'vitest';
import { applyListingPatch, PROJECT_OWNED_FIELDS, ListingPatchSchema } from '../mcp-host-server/src/listing-patch.js';
import type { RegistryProject } from '../mcp-host-server/src/contract/registry.js';

const staticEntry = (): RegistryProject => ({
  slug: 'demo-app',
  name: 'Demo',
  displayName: 'Demo App',
  tagline: 'A demo',
  category: 'tools',
  status: 'live',
  year: 2026,
  public: false,
  launchedAt: '2026-01-01',
  host: { kind: 'static-path', path: '/projects/demo-app/' },
  listing: { detail: 'old detail', metric: '10', metricLabel: 'users' },
});

const externalEntry = (): RegistryProject => ({
  slug: 'ext-app',
  name: 'Ext',
  tagline: 'External',
  category: 'tools',
  status: 'live',
  year: 2026,
  host: { kind: 'external-url', url: 'https://example.com' },
});

describe('applyListingPatch', () => {
  it('exposes the project-owned field list and strict schema', () => {
    expect([...PROJECT_OWNED_FIELDS]).toEqual([
      'name', 'displayName', 'tagline', 'category', 'tags', 'status', 'thumbnail', 'listing',
    ]);
    expect(ListingPatchSchema.safeParse({ slug: 'x' }).success).toBe(false);
  });

  it('applies an allowed patch', () => {
    const out = applyListingPatch(staticEntry(), { tagline: 'New tagline', tags: ['a', 'b'], status: 'cooking' });
    expect(out.tagline).toBe('New tagline');
    expect(out.tags).toEqual(['a', 'b']);
    expect(out.status).toBe('cooking');
    expect(out.slug).toBe('demo-app');
    expect(out.public).toBe(false);
  });

  it('rejects public: true', () => {
    expect(() => applyListingPatch(staticEntry(), { public: true })).toThrow(/fields not owned by the project: public/);
  });

  it('rejects slug and host', () => {
    expect(() => applyListingPatch(staticEntry(), { slug: 'other', host: {} })).toThrow(/slug, host/);
  });

  it('rejects tagline over 160 chars', () => {
    expect(() => applyListingPatch(staticEntry(), { tagline: 'x'.repeat(161) })).toThrow();
  });

  it('replaces listing wholesale', () => {
    const out = applyListingPatch(staticEntry(), { listing: { detail: 'fresh' } });
    expect(out.listing).toEqual({ detail: 'fresh' });
  });

  it('null deletes displayName', () => {
    const out = applyListingPatch(staticEntry(), { displayName: null });
    expect('displayName' in out).toBe(false);
  });

  it('accepts https url on external-url and rejects http://', () => {
    const out = applyListingPatch(externalEntry(), { url: 'https://new.example.com' });
    expect(out.host).toEqual({ kind: 'external-url', url: 'https://new.example.com' });
    expect(() => applyListingPatch(externalEntry(), { url: 'http://new.example.com' })).toThrow();
  });

  it('rejects url on static-path', () => {
    expect(() => applyListingPatch(staticEntry(), { url: 'https://x.example.com' })).toThrow(/url/);
  });

  it('does not mutate the input entry', () => {
    const entry = staticEntry();
    const snapshot = structuredClone(entry);
    applyListingPatch(entry, { tagline: 'changed', displayName: null, listing: { detail: 'z' } });
    expect(entry).toEqual(snapshot);
  });
});

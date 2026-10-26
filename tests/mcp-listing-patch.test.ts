import { describe, it, expect } from 'vitest';
import { applyListingPatch, PROJECT_OWNED_FIELDS, ListingPatchSchema, removedFields } from '../mcp-host-server/src/listing-patch.js';
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

  it('merges listing key by key: a partial listing patch keeps avoidClaims and every other key', () => {
    const entry = staticEntry();
    entry.listing = { ...entry.listing, avoidClaims: ['Demo is a SaaS'], offering: 'free-tool', pricing: 'free' };
    const out = applyListingPatch(entry, { listing: { audience: 'Students', talkingPoints: ['No account'] } });
    expect(out.listing).toEqual({
      detail: 'old detail',
      metric: '10',
      metricLabel: 'users',
      avoidClaims: ['Demo is a SaaS'],
      offering: 'free-tool',
      pricing: 'free',
      audience: 'Students',
      talkingPoints: ['No account'],
    });
  });

  it('overwrites a listing key it names, and replaces arrays whole', () => {
    const entry = staticEntry();
    entry.listing = { ...entry.listing, avoidClaims: ['a', 'b'] };
    const out = applyListingPatch(entry, { listing: { detail: 'fresh', avoidClaims: ['c'] } });
    expect(out.listing).toEqual({ detail: 'fresh', metric: '10', metricLabel: 'users', avoidClaims: ['c'] });
  });

  it('a null listing key deletes only that key', () => {
    const out = applyListingPatch(staticEntry(), { listing: { metric: null, metricLabel: null, audience: 'Devs' } });
    expect(out.listing).toEqual({ detail: 'old detail', audience: 'Devs' });
  });

  it('drops listing entirely when null keys empty it', () => {
    const out = applyListingPatch(staticEntry(), { listing: { detail: null, metric: null, metricLabel: null } });
    expect('listing' in out).toBe(false);
  });

  it('listing: null deletes the whole listing', () => {
    const out = applyListingPatch(staticEntry(), { listing: null });
    expect('listing' in out).toBe(false);
  });

  it('an empty listing patch changes nothing', () => {
    expect(applyListingPatch(staticEntry(), { listing: {} }).listing).toEqual(staticEntry().listing);
  });

  it('adds a listing to an entry that has none', () => {
    expect(applyListingPatch(externalEntry(), { listing: { audience: 'Devs' } }).listing).toEqual({ audience: 'Devs' });
  });

  it('rejects unknown listing keys, set or null', () => {
    expect(() => applyListingPatch(staticEntry(), { listing: { bogus: 'x' } })).toThrow(/bogus/);
    expect(() => applyListingPatch(staticEntry(), { listing: { bogus: null } })).toThrow(/unknown listing fields: bogus/);
  });

  it('still validates each listing value it merges', () => {
    expect(() => applyListingPatch(staticEntry(), { listing: { talkingPoints: ['x', 'x', 'x', 'x', 'x', 'x'] } })).toThrow();
    expect(() => applyListingPatch(staticEntry(), { listing: { pricing: 'cheap' } })).toThrow();
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
    applyListingPatch(entry, { tagline: 'changed', displayName: null, listing: { detail: 'z', metric: null } });
    expect(entry).toEqual(snapshot);
  });
});

describe('removedFields', () => {
  it('names deleted top-level fields and listing keys', () => {
    const before = staticEntry();
    before.listing = { ...before.listing, avoidClaims: ['x'] };
    const after = applyListingPatch(before, { displayName: null, listing: { avoidClaims: null, audience: 'Devs' } });
    expect(removedFields(before, after)).toEqual(['displayName', 'listing.avoidClaims']);
  });

  it('is empty for a partial listing patch', () => {
    const before = staticEntry();
    expect(removedFields(before, applyListingPatch(before, { listing: { audience: 'Devs' } }))).toEqual([]);
  });

  it('lists every listing key when the listing is deleted', () => {
    const before = staticEntry();
    expect(removedFields(before, applyListingPatch(before, { listing: null }))).toEqual([
      'listing.detail', 'listing.metric', 'listing.metricLabel',
    ]);
  });
});

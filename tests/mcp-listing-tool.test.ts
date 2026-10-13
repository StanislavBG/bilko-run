import { describe, it, expect } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { updateListingInRegistry, buildRegistration, readListingFile, assertPublishOwner } from '../mcp-host-server/src/listing-tool.js';
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

describe('readListingFile', () => {
  function tmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'listing-file-'));
  }

  it('returns undefined when the file is absent', () => {
    expect(readListingFile(tmp())).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'bilko.listing.json'), '{nope');
    expect(() => readListingFile(d)).toThrow(/^bilko\.listing\.json: /);
  });

  it('throws when the file is over 16 KB', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'bilko.listing.json'), JSON.stringify({ tagline: 'x'.repeat(17000) }));
    expect(() => readListingFile(d)).toThrow(/bilko\.listing\.json: .*limit/);
  });

  it('returns the parsed object for a valid file', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'bilko.listing.json'), JSON.stringify({ tagline: 'Hi' }));
    expect(readListingFile(d)).toEqual({ tagline: 'Hi' });
  });

  it('a file containing public: true is rejected by updateListingInRegistry', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'bilko.listing.json'), JSON.stringify({ tagline: 'Hi', public: true }));
    const patch = readListingFile(d);
    expect(() => updateListingInRegistry(registry(), 'demo', OWNER, patch)).toThrow();
  });
});

describe('assertPublishOwner', () => {
  it('rejects an unknown slug', () => {
    expect(() => assertPublishOwner(registry(), 'nope', OWNER)).toThrow(
      'slug "nope" is not registered. Call register_static_project first.',
    );
  });
  it('rejects a non-owner path', () => {
    expect(() => assertPublishOwner(registry(), 'demo', '/tmp/listing-tool-intruder')).toThrow(/is owned by/);
  });
  it('accepts the owner path', () => {
    expect(() => assertPublishOwner(registry(), 'demo', OWNER)).not.toThrow();
  });
});

describe('updateListingInRegistry patch wire shapes', () => {
  it('null deletes an optional field', () => {
    const base = registry();
    base[0] = { ...base[0], displayName: 'Shown' };
    const { next } = updateListingInRegistry(base, 'demo', OWNER, { displayName: null });
    expect(next[0].displayName).toBeUndefined();
  });
  it('url sets host.url on an external-url entry', () => {
    const ext = RegistrySchema.parse([
      {
        slug: 'ext',
        name: 'Ext',
        tagline: 'T',
        category: 'Game',
        status: 'live',
        year: 2026,
        host: { kind: 'external-url', url: 'https://old.example', localPath: OWNER },
      },
    ]);
    const { next } = updateListingInRegistry(ext, 'ext', OWNER, { url: 'https://x.example' });
    expect((next[0].host as { url: string }).url).toBe('https://x.example');
  });
});

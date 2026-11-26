import { describe, it, expect, vi } from 'vitest';
import {
  registerProjectLive,
  updateListingLive,
  unregisterProjectLive,
  type RegistryWriteApi,
} from '../mcp-host-server/src/listing-tool.js';

const OWNER = '/tmp/registry-listing-owner-repo';
const OTHER = '/tmp/registry-listing-other-repo';

const demo = {
  slug: 'demo',
  name: 'Demo',
  tagline: 'Old tagline',
  category: 'Game',
  status: 'live',
  year: 2026,
  host: { kind: 'static-path', path: '/projects/demo/', localPath: OWNER },
};

function mockApi(version = 4, overrides: Partial<RegistryWriteApi> = {}) {
  const api = {
    read: vi.fn(async () => [{ entry: structuredClone(demo) as Record<string, unknown>, version }]),
    put: vi.fn(async (e: { slug: string }) => ({ slug: e.slug, version: version + 1 })),
    del: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
  return api;
}

const mismatch = () => new Error('registry put "demo" failed: HTTP 409 version_mismatch');

const reg = {
  slug: 'fresh',
  name: 'Fresh',
  tagline: 'New app',
  category: 'Game',
  status: 'live' as const,
  year: 2026,
  callerRepoPath: '/tmp/registry-listing-fresh-repo',
};

describe('registerProjectLive', () => {
  it('registers a static-path entry with ifVersion 0 (must not exist)', async () => {
    const api = mockApi();
    await registerProjectLive(reg, api);
    const [entry, ifVersion] = api.put.mock.calls[0] as unknown as [{ slug: string; host: { kind: string } }, number];
    expect(entry.slug).toBe('fresh');
    expect(entry.host.kind).toBe('static-path');
    expect(ifVersion).toBe(0);
  });

  it('registers an external-url entry', async () => {
    const api = mockApi();
    await registerProjectLive({ ...reg, url: 'https://fresh.example.com' }, api);
    const [entry] = api.put.mock.calls[0] as unknown as [{ host: { kind: string } }];
    expect(entry.host.kind).toBe('external-url');
  });

  it('refuses a slug that already exists, without writing', async () => {
    const api = mockApi();
    await expect(registerProjectLive({ ...reg, slug: 'demo' }, api)).rejects.toThrow(/already registered/);
    expect(api.put).not.toHaveBeenCalled();
  });
});

describe('updateListingLive', () => {
  it('writes the patched entry with the version it read', async () => {
    const api = mockApi(7);
    const r = await updateListingLive('demo', OWNER, { tagline: 'New tagline' }, api);
    expect(r.changed).toBe(true);
    const [entry, ifVersion] = api.put.mock.calls[0] as unknown as [{ tagline: string }, number];
    expect(entry.tagline).toBe('New tagline');
    expect(ifVersion).toBe(7);
  });

  it('writes nothing when the patch changes nothing', async () => {
    const api = mockApi();
    expect((await updateListingLive('demo', OWNER, { tagline: 'Old tagline' }, api)).changed).toBe(false);
    expect(api.put).not.toHaveBeenCalled();
  });

  it('refuses a caller that does not own the slug', async () => {
    const api = mockApi();
    await expect(updateListingLive('demo', OTHER, { tagline: 'x' }, api)).rejects.toThrow(/is owned by/);
    expect(api.put).not.toHaveBeenCalled();
  });

  it('re-reads once on version_mismatch and retries the same change', async () => {
    let n = 0;
    const api = mockApi(4);
    api.read.mockImplementation(async () => [{ entry: structuredClone(demo) as Record<string, unknown>, version: 4 + n++ }]);
    api.put.mockImplementationOnce(async () => {
      throw mismatch();
    });
    const r = await updateListingLive('demo', OWNER, { tagline: 'Again' }, api);
    expect(r.changed).toBe(true);
    expect(api.read).toHaveBeenCalledTimes(2);
    expect(api.put.mock.calls.map((c) => (c as unknown[])[1])).toEqual([4, 5]);
  });

  it('returns an error after a second version_mismatch', async () => {
    const api = mockApi();
    api.put.mockImplementation(async () => {
      throw mismatch();
    });
    await expect(updateListingLive('demo', OWNER, { tagline: 'Again' }, api)).rejects.toThrow(/version_mismatch/);
    expect(api.put).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const api = mockApi();
    api.put.mockRejectedValue(new Error('registry put "demo" failed: HTTP 500'));
    await expect(updateListingLive('demo', OWNER, { tagline: 'Again' }, api)).rejects.toThrow(/500/);
    expect(api.put).toHaveBeenCalledTimes(1);
  });
});

describe('unregisterProjectLive', () => {
  it('deletes with the version it read', async () => {
    const api = mockApi(9);
    await unregisterProjectLive('demo', OWNER, api);
    expect(api.del).toHaveBeenCalledWith('demo', 9);
  });

  it('refuses a caller that does not own the slug', async () => {
    const api = mockApi();
    await expect(unregisterProjectLive('demo', OTHER, api)).rejects.toThrow(/is owned by/);
    expect(api.del).not.toHaveBeenCalled();
  });

  it('refuses an unknown slug', async () => {
    const api = mockApi();
    await expect(unregisterProjectLive('nope', OWNER, api)).rejects.toThrow(/not found/);
  });

  it('retries once on version_mismatch', async () => {
    const api = mockApi();
    api.del.mockRejectedValueOnce(new Error('registry delete "demo" failed: HTTP 409 version_mismatch'));
    await unregisterProjectLive('demo', OWNER, api);
    expect(api.del).toHaveBeenCalledTimes(2);
  });
});

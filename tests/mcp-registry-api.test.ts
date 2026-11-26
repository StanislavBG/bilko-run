import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deleteRegistryProject,
  putRegistryProject,
  readRegistry,
} from '../mcp-host-server/src/registry-api.js';
import { readLatestRegistryRaw } from '../mcp-host-server/src/registry-source.js';

const ENV_KEYS = ['BILKO_ADMIN_KEY', 'BILKO_ADMIN_KEY_FILE', 'BILKO_REGISTRY_KEY', 'BILKO_REGISTRY_KEY_FILE', 'BILKO_HOST_URL'];
let saved: Record<string, string | undefined>;
let dir: string;
const fetchMock = vi.fn();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  dir = mkdtempSync(join(tmpdir(), 'reg-api-'));
  process.env.BILKO_ADMIN_KEY_FILE = join(dir, 'none-admin');
  process.env.BILKO_REGISTRY_KEY_FILE = join(dir, 'none-reg');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  rmSync(dir, { recursive: true, force: true });
});

describe('readRegistry', () => {
  it('GETs /api/admin/registry with the read key from the env', async () => {
    process.env.BILKO_ADMIN_KEY = 'bka_read';
    fetchMock.mockResolvedValue(json(200, { projects: [{ entry: { slug: 'a' }, version: 3 }] }));
    expect(await readRegistry()).toEqual([{ entry: { slug: 'a' }, version: 3 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://bilko.run/api/admin/registry');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer bka_read');
  });

  it('reads the key from the admin key file and honours BILKO_HOST_URL', async () => {
    const f = join(dir, 'admin-key');
    writeFileSync(f, 'bka_file\n', { mode: 0o600 });
    process.env.BILKO_ADMIN_KEY_FILE = f;
    process.env.BILKO_HOST_URL = 'http://localhost:9/';
    fetchMock.mockResolvedValue(json(200, { projects: [] }));
    await readRegistry();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9/api/admin/registry');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer bka_file');
  });

  it('names the HTTP status and API error without leaking the key', async () => {
    process.env.BILKO_ADMIN_KEY = 'bka_secret';
    fetchMock.mockResolvedValue(json(403, { error: 'forbidden bka_secret' }));
    const err = await readRegistry().catch((e: Error) => e);
    expect((err as Error).message).toContain('HTTP 403');
    expect((err as Error).message).toContain('forbidden');
    expect((err as Error).message).not.toContain('bka_secret');
  });
});

describe('registry writes', () => {
  it('PUT sends the registry key, entry and ifVersion', async () => {
    process.env.BILKO_REGISTRY_KEY = 'bka_reg';
    process.env.BILKO_ADMIN_KEY = 'bka_read';
    fetchMock.mockResolvedValue(json(200, { slug: 'a', version: 4 }));
    expect(await putRegistryProject({ slug: 'a', title: 'A' }, 3)).toEqual({ slug: 'a', version: 4 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://bilko.run/api/admin/registry/a');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe('Bearer bka_reg');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ entry: { slug: 'a', title: 'A' }, ifVersion: 3 });
  });

  it('omits ifVersion when not given', async () => {
    process.env.BILKO_REGISTRY_KEY = 'bka_reg';
    fetchMock.mockResolvedValue(json(200, { slug: 'a', version: 1 }));
    await putRegistryProject({ slug: 'a' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ entry: { slug: 'a' } });
  });

  it('DELETE passes ifVersion as a query and uses the key file when no env key', async () => {
    const f = join(dir, 'registry-key');
    writeFileSync(f, 'bka_regfile\n', { mode: 0o600 });
    process.env.BILKO_REGISTRY_KEY_FILE = f;
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    expect(await deleteRegistryProject('a b', 7)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://bilko.run/api/admin/registry/a%20b?ifVersion=7');
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer bka_regfile');
  });

  it('maps 409 and 400 errors with the API error and issues', async () => {
    process.env.BILKO_REGISTRY_KEY = 'bka_reg';
    fetchMock.mockResolvedValueOnce(json(409, { error: 'version_mismatch', version: 5 }));
    await expect(putRegistryProject({ slug: 'a' }, 1)).rejects.toThrow(/HTTP 409 version_mismatch/);
    fetchMock.mockResolvedValueOnce(json(400, { error: 'invalid_entry', issues: ['slug: bad'] }));
    await expect(putRegistryProject({ slug: 'a' })).rejects.toThrow(/HTTP 400 invalid_entry: slug: bad/);
  });

  it('fails without calling the API when no registry key exists, and rejects loose key files', async () => {
    await expect(putRegistryProject({ slug: 'a' })).rejects.toThrow(/BILKO_REGISTRY_KEY is not set/);
    const f = join(dir, 'loose');
    writeFileSync(f, 'bka_x', { mode: 0o644 });
    process.env.BILKO_REGISTRY_KEY_FILE = f;
    await expect(deleteRegistryProject('a')).rejects.toThrow(/chmod 600/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('readLatestRegistryRaw', () => {
  it('returns API entries as the registry with versions and no git', async () => {
    const out = await readLatestRegistryRaw('/nonexistent', {
      read: async () => [{ entry: { slug: 'a' }, version: 2 }],
    });
    expect(out.source).toBe('api');
    expect(JSON.parse(out.raw)).toEqual([{ slug: 'a' }]);
    expect(out.versions).toEqual({ a: 2 });
  });
});

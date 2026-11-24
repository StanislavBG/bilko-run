import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appTeam, type AppTeamDeps } from '../mcp-host-server/src/app-team-tool.js';
import type { RegistryProject } from '../mcp-host-server/src/contract/registry.js';

const REGISTRY = 'src/data/standalone-projects.json';
const KEY = 'reg-secret-key-123';

interface Call { url: string; method: string; headers: Record<string, string>; body?: string }

function mockFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fn, calls };
}

describe('appTeam', () => {
  let tmp: string;
  let hostDir: string;
  let owner: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'app-team-'));
    hostDir = join(tmp, 'host');
    owner = join(tmp, 'owner-repo');
    await mkdir(owner, { recursive: true });
    await mkdir(join(hostDir, 'src/data'), { recursive: true });
    const projects = [
      {
        slug: 'stat', name: 'Stat', tagline: 'T', category: 'Game', status: 'live', year: 2026,
        host: { kind: 'static-path', path: '/projects/stat/', localPath: owner },
      },
    ] as RegistryProject[];
    await writeFile(join(hostDir, REGISTRY), JSON.stringify(projects, null, 2) + '\n', 'utf8');
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  function deps(fetchFn: typeof fetch, env: Record<string, string | undefined> = { BILKO_REGISTRY_KEY: KEY }): AppTeamDeps {
    return {
      hostRoot: hostDir,
      fetch: fetchFn,
      env: { BILKO_HOST_URL: 'https://bilko.test/', ...env },
      readFile: async () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
    };
  }

  it('refuses a caller that does not own the slug without any fetch', async () => {
    const m = mockFetch(200, {});
    const r = await appTeam({ slug: 'stat', callerRepoPath: join(tmp, 'someone-else'), action: 'list' }, deps(m.fn));
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/owned by/);
    expect(m.calls).toHaveLength(0);
  });

  it('refuses an unknown slug without any fetch', async () => {
    const m = mockFetch(200, {});
    const r = await appTeam({ slug: 'nope', callerRepoPath: owner, action: 'list' }, deps(m.fn));
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/not found/);
    expect(m.calls).toHaveLength(0);
  });

  it('list sends GET /api/db/<slug>/team with the bearer key and prints one line per member', async () => {
    const m = mockFetch(200, {
      app: 'stat', role: 'admin',
      members: [
        { email: 'a@example.com', role: 'owner', addedAt: '2026-11-23T00:00:00Z' },
        { email: 'b@example.com', role: 'member', addedAt: '2026-11-23T01:00:00Z' },
      ],
    });
    const r = await appTeam({ slug: 'stat', callerRepoPath: owner, action: 'list' }, deps(m.fn));
    expect(r.ok).toBe(true);
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0].method).toBe('GET');
    expect(m.calls[0].url).toBe('https://bilko.test/api/db/stat/team');
    expect(m.calls[0].headers.authorization).toBe(`Bearer ${KEY}`);
    expect(m.calls[0].body).toBeUndefined();
    const lines = r.text.split('\n');
    expect(lines.some((l) => l.includes('a@example.com') && l.includes('owner'))).toBe(true);
    expect(lines.some((l) => l.includes('b@example.com') && l.includes('member'))).toBe(true);
    expect(r.text).not.toContain(KEY);
  });

  it('set sends PUT with JSON { role } to the encoded member URL', async () => {
    const m = mockFetch(200, { email: 'x+y@example.com', role: 'member', created: true });
    const r = await appTeam(
      { slug: 'stat', callerRepoPath: owner, action: 'set', email: 'x+y@example.com', role: 'member' },
      deps(m.fn),
    );
    expect(r.ok).toBe(true);
    expect(m.calls[0].method).toBe('PUT');
    expect(m.calls[0].url).toBe(`https://bilko.test/api/db/stat/team/members/${encodeURIComponent('x+y@example.com')}`);
    expect(m.calls[0].headers.authorization).toBe(`Bearer ${KEY}`);
    expect(m.calls[0].headers['content-type']).toMatch(/application\/json/);
    expect(JSON.parse(m.calls[0].body!)).toEqual({ role: 'member' });
    expect(r.text).toContain('x+y@example.com');
  });

  it('remove sends DELETE to the encoded member URL', async () => {
    const m = mockFetch(200, { ok: true });
    const r = await appTeam(
      { slug: 'stat', callerRepoPath: owner, action: 'remove', email: 'b@example.com' },
      deps(m.fn),
    );
    expect(r.ok).toBe(true);
    expect(m.calls[0].method).toBe('DELETE');
    expect(m.calls[0].url).toBe('https://bilko.test/api/db/stat/team/members/b%40example.com');
    expect(m.calls[0].headers.authorization).toBe(`Bearer ${KEY}`);
  });

  it('set without email or role fails without a fetch', async () => {
    const m = mockFetch(200, {});
    expect((await appTeam({ slug: 'stat', callerRepoPath: owner, action: 'set', role: 'member' }, deps(m.fn))).ok).toBe(false);
    expect((await appTeam({ slug: 'stat', callerRepoPath: owner, action: 'set', email: 'a@example.com' }, deps(m.fn))).ok).toBe(false);
    expect(m.calls).toHaveLength(0);
  });

  it('reads the key from BILKO_REGISTRY_KEY_FILE, then the default path', async () => {
    const m = mockFetch(200, { app: 'stat', role: 'admin', members: [] });
    const seen: string[] = [];
    const d: AppTeamDeps = {
      hostRoot: hostDir,
      fetch: m.fn,
      env: { BILKO_REGISTRY_KEY_FILE: '/keys/registry' },
      readFile: async (p: string) => { seen.push(p); return 'file-key\n'; },
    };
    const r = await appTeam({ slug: 'stat', callerRepoPath: owner, action: 'list' }, d);
    expect(r.ok).toBe(true);
    expect(seen).toEqual(['/keys/registry']);
    expect(m.calls[0].headers.authorization).toBe('Bearer file-key');
    expect(m.calls[0].url).toBe('https://bilko.run/api/db/stat/team');

    seen.length = 0;
    await appTeam({ slug: 'stat', callerRepoPath: owner, action: 'list' }, { ...d, env: {} });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/\.config\/bilko-host\/registry-key$/);
  });

  it('a missing key says the owner must mint a registry-scope admin key, with no fetch', async () => {
    const m = mockFetch(200, {});
    const r = await appTeam({ slug: 'stat', callerRepoPath: owner, action: 'list' }, deps(m.fn, { BILKO_REGISTRY_KEY: undefined }));
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/owner must mint a registry-scope admin key/);
    expect(m.calls).toHaveLength(0);
  });

  it('maps API errors to the HTTP status and error code without printing the key', async () => {
    for (const [status, code] of [[409, 'last_owner'], [404, 'not_found'], [400, 'bad_email'], [409, 'team_full'], [403, 'not_member']] as const) {
      const m = mockFetch(status, { error: code });
      const r = await appTeam(
        { slug: 'stat', callerRepoPath: owner, action: 'remove', email: 'a@example.com' },
        deps(m.fn),
      );
      expect(r.ok).toBe(false);
      expect(r.text).toContain(String(status));
      expect(r.text).toContain(code);
      expect(r.text).not.toContain(KEY);
    }
  });

  it('reports a network failure as text', async () => {
    const fn = (async () => { throw new Error('offline'); }) as typeof fetch;
    const r = await appTeam({ slug: 'stat', callerRepoPath: owner, action: 'list' }, deps(fn));
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/offline/);
  });
});

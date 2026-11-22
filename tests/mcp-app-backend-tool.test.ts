import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setBackendInRegistry, setAppBackend } from '../mcp-host-server/src/app-backend-tool.js';
import { RegistrySchema, type RegistryProject } from '../mcp-host-server/src/contract/registry.js';

const exec = promisify(execFile);

process.env.GIT_AUTHOR_NAME = 'Test Author';
process.env.GIT_AUTHOR_EMAIL = 'test-author@example.com';
process.env.GIT_COMMITTER_NAME = 'Test Committer';
process.env.GIT_COMMITTER_EMAIL = 'test-committer@example.com';

const REGISTRY = 'src/data/standalone-projects.json';
const BASE_URL = 'https://bilko.test';
const OWNER = '/tmp/app-backend-owner-repo';

async function git(cwd: string, args: string[]): Promise<string> {
  return (await exec('git', args, { cwd })).stdout.trim();
}

function registry(owner: string): RegistryProject[] {
  return [
    {
      slug: 'ext', name: 'Ext', tagline: 'T', category: 'Game', status: 'live', year: 2026,
      host: { kind: 'external-url', url: 'https://ext.example.app', localPath: owner },
    },
    {
      slug: 'stat', name: 'Stat', tagline: 'T', category: 'Game', status: 'live', year: 2026,
      host: { kind: 'static-path', path: '/projects/stat/', localPath: owner },
    },
  ] as RegistryProject[];
}

function healthFetch(appBackends: Record<string, string> | 'throw') {
  const calls: string[] = [];
  const fn = (async (url: string | URL | Request) => {
    calls.push(String(url));
    if (appBackends === 'throw') throw new Error('offline');
    return new Response(JSON.stringify({ status: 'ok', appBackends }), { status: 200 });
  }) as typeof fetch;
  return { fn, calls };
}

describe('setBackendInRegistry', () => {
  const projects = () => registry(OWNER);

  it('throws for an unknown slug', () => {
    expect(() => setBackendInRegistry(projects(), 'nope', OWNER, 'https://api.example.com')).toThrow(/not found/);
  });

  it('throws when the caller does not own the slug', () => {
    expect(() => setBackendInRegistry(projects(), 'stat', '/tmp/someone-else', 'https://api.example.com')).toThrow(/owned by/);
    expect(() => setBackendInRegistry(projects(), 'stat', undefined, 'https://api.example.com')).toThrow(/callerRepoPath/);
  });

  it('throws for an external-url entry', () => {
    expect(() => setBackendInRegistry(projects(), 'ext', OWNER, 'https://api.example.com')).toThrow(/static-path/);
  });

  it.each([
    ['http://api.example.com', /https/],
    ['https://api.example.com/v1', /path/],
    ['https://api.example.com/?a=1', /query/],
    ['https://api.example.com/#x', /hash/],
    ['https://u:p@api.example.com', /credentials/],
    ['not a url', /valid URL/],
  ])('refuses origin %s', (origin, re) => {
    expect(() => setBackendInRegistry(projects(), 'stat', OWNER, origin)).toThrow(re);
  });

  it('sets and normalizes the origin, and the result validates', () => {
    const input = projects();
    const r = setBackendInRegistry(input, 'stat', OWNER, 'https://X.example.com/');
    expect(r.changed).toBe(true);
    expect(r.previous).toBeUndefined();
    expect(r.current).toBe('https://x.example.com');
    const entry = r.next.find((p) => p.slug === 'stat')!;
    expect(entry.host).toMatchObject({ kind: 'static-path', backend: 'https://x.example.com' });
    expect(() => RegistrySchema.parse(r.next)).not.toThrow();
    expect((input[1].host as { backend?: string }).backend).toBeUndefined();
  });

  it('clears with null, and reports unchanged when nothing changes', () => {
    const set = setBackendInRegistry(projects(), 'stat', OWNER, 'https://api.example.com').next;
    const same = setBackendInRegistry(set, 'stat', OWNER, 'https://api.example.com/');
    expect(same.changed).toBe(false);
    const cleared = setBackendInRegistry(set, 'stat', OWNER, null);
    expect(cleared.changed).toBe(true);
    expect(cleared.previous).toBe('https://api.example.com');
    expect(cleared.current).toBeUndefined();
    expect('backend' in cleared.next[1].host).toBe(false);
    expect(() => RegistrySchema.parse(cleared.next)).not.toThrow();
    expect(setBackendInRegistry(projects(), 'stat', OWNER, null).changed).toBe(false);
  });
});

describe('setAppBackend', () => {
  let tmp: string;
  let originDir: string;
  let hostDir: string;
  let checkoutDir: string;
  let owner: string;

  async function origin(): Promise<{ projects: any[]; subject: string; count: number }> {
    const dir = await mkdtemp(join(tmp, 'verify-'));
    await exec('git', ['clone', '--quiet', originDir, dir]);
    const projects = JSON.parse(await readFile(join(dir, REGISTRY), 'utf8'));
    const subject = await git(dir, ['log', '-1', '--format=%s']);
    const count = Number(await git(dir, ['rev-list', '--count', 'HEAD']));
    return { projects, subject, count };
  }

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'set-app-backend-'));
    originDir = resolve(tmp, 'origin.git');
    hostDir = resolve(tmp, 'host');
    checkoutDir = resolve(tmp, 'checkout');
    owner = resolve(tmp, 'owner-repo');
    await mkdir(owner, { recursive: true });
    await mkdir(originDir, { recursive: true });
    await git(originDir, ['init', '--bare', '-b', 'main']);
    await exec('git', ['clone', '--quiet', originDir, hostDir]);
    await mkdir(join(hostDir, 'src/data'), { recursive: true });
    await writeFile(join(hostDir, REGISTRY), JSON.stringify(registry(owner), null, 2) + '\n', 'utf8');
    await git(hostDir, ['add', '.']);
    await git(hostDir, ['commit', '-m', 'seed']);
    await git(hostDir, ['push', '--quiet', 'origin', 'main']);
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('sets, re-sets (no change) and clears host.backend through pushed commits', async () => {
    const h = healthFetch({});
    const deps = { hostRoot: hostDir, checkoutDir, baseUrl: BASE_URL, fetch: h.fn };

    const set = await setAppBackend({ slug: 'stat', callerRepoPath: owner, origin: 'https://api.example.com/' }, deps);
    expect(set.ok, set.text).toBe(true);
    expect(set.text).toContain('backend: stat -> https://api.example.com');
    expect(set.text).toContain('forwards /projects/stat/api/* -> https://api.example.com/api/*');
    expect(set.text).toMatch(/pushed: [0-9a-f]{7,}/);
    expect(set.text).toContain(`GET ${BASE_URL}/api/health shows appBackends.stat = "registry"`);
    expect(set.text).not.toContain('APP_BACKENDS');
    expect(h.calls).toEqual([`${BASE_URL}/api/health`]);
    let o = await origin();
    expect(o.subject).toBe('registry: set backend for stat');
    expect(o.projects.find((p) => p.slug === 'stat').host.backend).toBe('https://api.example.com');
    const countAfterSet = o.count;

    const again = await setAppBackend({ slug: 'stat', callerRepoPath: owner, origin: 'https://api.example.com' }, deps);
    expect(again).toEqual({ ok: true, text: 'no change: stat' });
    expect((await origin()).count).toBe(countAfterSet);

    const cleared = await setAppBackend({ slug: 'stat', callerRepoPath: owner, origin: null }, deps);
    expect(cleared.ok, cleared.text).toBe(true);
    expect(cleared.text).toContain('backend cleared: stat');
    o = await origin();
    expect(o.subject).toBe('registry: clear backend for stat');
    expect('backend' in o.projects.find((p) => p.slug === 'stat').host).toBe(false);
  });

  it('refuses a caller that does not own the slug without committing', async () => {
    const res = await setAppBackend(
      { slug: 'stat', callerRepoPath: join(tmp, 'intruder'), origin: 'https://api.example.com' },
      { hostRoot: hostDir, checkoutDir, baseUrl: BASE_URL, fetch: healthFetch({}).fn },
    );
    expect(res.ok).toBe(false);
    expect(res.text).toMatch(/owned by/);
    expect((await origin()).count).toBe(1);
  });

  it('notes when APP_BACKENDS on Render overrides the registry for the slug', async () => {
    const h = healthFetch({ stat: 'env' });
    const res = await setAppBackend(
      { slug: 'stat', callerRepoPath: owner, origin: 'https://api.example.com' },
      { hostRoot: hostDir, checkoutDir, baseUrl: BASE_URL, fetch: h.fn },
    );
    expect(res.ok, res.text).toBe(true);
    expect(res.text).toMatch(/APP_BACKENDS on Render overrides the registry for stat/);
  });

  it('ignores a failing health fetch', async () => {
    const res = await setAppBackend(
      { slug: 'stat', callerRepoPath: owner, origin: 'https://api.example.com' },
      { hostRoot: hostDir, checkoutDir, baseUrl: BASE_URL, fetch: healthFetch('throw').fn },
    );
    expect(res.ok, res.text).toBe(true);
    expect(res.text).not.toContain('APP_BACKENDS');
  });
});

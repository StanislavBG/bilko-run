import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setBackendInRegistry } from '../mcp-host-server/src/app-backend-tool.js';
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

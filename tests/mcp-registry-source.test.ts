import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { readLatestRegistryRaw, REGISTRY_PATH } from '../mcp-host-server/src/registry-source.js';

const exec = promisify(execFile);

process.env.GIT_AUTHOR_NAME = 'Test Author';
process.env.GIT_AUTHOR_EMAIL = 'test-author@example.com';
process.env.GIT_COMMITTER_NAME = 'Test Committer';
process.env.GIT_COMMITTER_EMAIL = 'test-committer@example.com';

async function git(cwd: string, args: string[]) {
  return exec('git', args, { cwd });
}

async function commitRegistry(dir: string, body: string, message: string) {
  await mkdir(join(dir, 'src/data'), { recursive: true });
  await writeFile(join(dir, REGISTRY_PATH), body, 'utf8');
  await git(dir, ['add', REGISTRY_PATH]);
  await git(dir, ['commit', '-m', message]);
  await git(dir, ['push', 'origin', 'main']);
}

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'registry-source-test-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('readLatestRegistryRaw', () => {
  it('returns origin/main\'s registry when the host checkout is behind, without moving host HEAD or tree', async () => {
    const originDir = resolve(tmp, 'origin.git');
    const hostDir = resolve(tmp, 'host');
    const publisherDir = resolve(tmp, 'publisher');
    await mkdir(originDir);
    await git(originDir, ['init', '--bare', '-b', 'main']);
    await exec('git', ['clone', originDir, hostDir]);
    await commitRegistry(hostDir, '["stale"]\n', 'seed');

    // Another checkout (the publish checkout) pushes a newer listing.
    await exec('git', ['clone', originDir, publisherDir]);
    await commitRegistry(publisherDir, '["fresh"]\n', 'listing: update academy');

    const headBefore = (await git(hostDir, ['rev-parse', 'HEAD'])).stdout;
    const out = await readLatestRegistryRaw(hostDir);

    expect(out.source).toBe('remote');
    expect(out.raw).toBe('["fresh"]\n');
    expect((await git(hostDir, ['rev-parse', 'HEAD'])).stdout).toBe(headBefore);
    expect((await git(hostDir, ['show', `HEAD:${REGISTRY_PATH}`])).stdout).toBe('["stale"]\n');
  });

  it('falls back to the working tree when there is no remote', async () => {
    const hostDir = resolve(tmp, 'solo');
    await mkdir(join(hostDir, 'src/data'), { recursive: true });
    await git(hostDir, ['init', '-b', 'main']);
    await writeFile(join(hostDir, REGISTRY_PATH), '["local"]\n', 'utf8');

    const out = await readLatestRegistryRaw(hostDir);

    expect(out.source).toBe('local');
    expect(out.raw).toBe('["local"]\n');
  });
});

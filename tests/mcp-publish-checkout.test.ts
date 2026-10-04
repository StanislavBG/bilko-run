import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { withPublishCheckout } from '../mcp-host-server/src/publish-checkout.js';

const exec = promisify(execFile);

process.env.GIT_AUTHOR_NAME = 'Test Author';
process.env.GIT_AUTHOR_EMAIL = 'test-author@example.com';
process.env.GIT_COMMITTER_NAME = 'Test Committer';
process.env.GIT_COMMITTER_EMAIL = 'test-committer@example.com';

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return exec('git', args, { cwd });
}

async function makeBareOrigin(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await git(dir, ['init', '--bare', '-b', 'main']);
}

async function cloneAndSeed(originDir: string, cloneDir: string): Promise<void> {
  await exec('git', ['clone', originDir, cloneDir]);
  await git(cloneDir, ['config', 'user.name', 'Test Author']);
  await git(cloneDir, ['config', 'user.email', 'test-author@example.com']);
  await writeFile(join(cloneDir, 'fileA.txt'), 'original\n', 'utf8');
  await git(cloneDir, ['add', 'fileA.txt']);
  await git(cloneDir, ['commit', '-m', 'seed']);
  await git(cloneDir, ['push', 'origin', 'main']);
}

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'publish-checkout-test-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('withPublishCheckout', () => {
  it('never commits a dirty staged file from the host clone, commits only returned paths, leaves host HEAD/index untouched', async () => {
    const originDir = resolve(tmp, 'origin.git');
    const hostDir = resolve(tmp, 'host');
    const checkoutDir = resolve(tmp, 'checkout');

    await makeBareOrigin(originDir);
    await cloneAndSeed(originDir, hostDir);

    // Dirty, staged file in the host clone — must never be committed by the checkout.
    await writeFile(join(hostDir, 'fileA.txt'), 'DIRTY STAGED CHANGE\n', 'utf8');
    await git(hostDir, ['add', 'fileA.txt']);

    const headBefore = (await git(hostDir, ['rev-parse', 'HEAD'])).stdout.trim();
    const statusBefore = (await git(hostDir, ['status', '--porcelain'])).stdout;

    const outcome = await withPublishCheckout(
      { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
      async (root) => {
        await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
        await writeFile(join(root, 'ignored-extra.txt'), 'should not be committed\n', 'utf8');
        return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.committed).toBe(true);
    expect(outcome.result).toBe('ok');
    expect(outcome.sha).toBeTruthy();

    // Verify via a fresh clone of origin: only fileB.txt landed, fileA.txt unchanged,
    // ignored-extra.txt (untracked, not in `paths`) never landed.
    const verifyDir = resolve(tmp, 'verify');
    await exec('git', ['clone', originDir, verifyDir]);
    const files = (await git(verifyDir, ['ls-tree', '-r', '--name-only', 'HEAD'])).stdout;
    expect(files).toContain('fileB.txt');
    expect(files).not.toContain('ignored-extra.txt');
    const fileAContent = await readFile(join(verifyDir, 'fileA.txt'), 'utf8');
    expect(fileAContent).toBe('original\n');

    const lastCommitFiles = (
      await git(verifyDir, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])
    ).stdout.trim();
    expect(lastCommitFiles).toBe('fileB.txt');

    // Host clone's HEAD and index must be exactly as they were.
    const headAfter = (await git(hostDir, ['rev-parse', 'HEAD'])).stdout.trim();
    const statusAfter = (await git(hostDir, ['status', '--porcelain'])).stdout;
    expect(headAfter).toBe(headBefore);
    expect(statusAfter).toBe(statusBefore);
  });

  it('returns ok with committed:false on an empty diff', async () => {
    const originDir = resolve(tmp, 'origin2.git');
    const hostDir = resolve(tmp, 'host2');
    const checkoutDir = resolve(tmp, 'checkout2');

    await makeBareOrigin(originDir);
    await cloneAndSeed(originDir, hostDir);

    const outcome = await withPublishCheckout(
      { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
      async () => {
        return { result: 'noop', paths: ['fileA.txt'], message: 'no real change' };
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.committed).toBe(false);
    expect(outcome.result).toBe('noop');
  });

  it('rebases onto a concurrent push between sync and push, then succeeds', async () => {
    const originDir = resolve(tmp, 'origin3.git');
    const hostDir = resolve(tmp, 'host3');
    const checkoutDir = resolve(tmp, 'checkout3');
    const concurrentCloneDir = resolve(tmp, 'concurrent-clone3');

    await makeBareOrigin(originDir);
    await cloneAndSeed(originDir, hostDir);

    const outcome = await withPublishCheckout(
      { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
      async (root) => {
        // Simulate a concurrent publisher landing a commit on origin/main
        // after our sync but before our push.
        await exec('git', ['clone', originDir, concurrentCloneDir]);
        await git(concurrentCloneDir, ['config', 'user.name', 'Concurrent']);
        await git(concurrentCloneDir, ['config', 'user.email', 'concurrent@example.com']);
        await writeFile(join(concurrentCloneDir, 'concurrent.txt'), 'hourly update\n', 'utf8');
        await git(concurrentCloneDir, ['add', 'concurrent.txt']);
        await git(concurrentCloneDir, ['commit', '-m', 'concurrent hourly publish']);
        await git(concurrentCloneDir, ['push', 'origin', 'main']);

        await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
        return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(`expected success, got stage=${(outcome as any).stage} error=${(outcome as any).error}`);
    expect(outcome.committed).toBe(true);

    const verifyDir = resolve(tmp, 'verify3');
    await exec('git', ['clone', originDir, verifyDir]);
    const files = (await git(verifyDir, ['ls-tree', '-r', '--name-only', 'HEAD'])).stdout;
    expect(files).toContain('fileB.txt');
    expect(files).toContain('concurrent.txt');
  });

  it('returns stage "push" after 3 attempts when the remote rejects every push', async () => {
    const originDir = resolve(tmp, 'origin4.git');
    const hostDir = resolve(tmp, 'host4');
    const checkoutDir = resolve(tmp, 'checkout4');

    await makeBareOrigin(originDir);
    await cloneAndSeed(originDir, hostDir);

    const hookPath = join(originDir, 'hooks', 'pre-receive');
    await writeFile(hookPath, '#!/bin/sh\nexit 1\n', { mode: 0o755 });

    const headBefore = (await git(hostDir, ['rev-parse', 'HEAD'])).stdout.trim();
    const statusBefore = (await git(hostDir, ['status', '--porcelain'])).stdout;

    const outcome = await withPublishCheckout(
      { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
      async (root) => {
        await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
        return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.stage).toBe('push');

    const headAfter = (await git(hostDir, ['rev-parse', 'HEAD'])).stdout.trim();
    const statusAfter = (await git(hostDir, ['status', '--porcelain'])).stdout;
    expect(headAfter).toBe(headBefore);
    expect(statusAfter).toBe(statusBefore);
  });

  it('creates a missing parent state directory before taking the lock', async () => {
    const originDir = resolve(tmp, 'origin6.git');
    const hostDir = resolve(tmp, 'host6');
    const checkoutDir = resolve(tmp, 'missing-state', 'bilko-host', 'publish-checkout');

    await makeBareOrigin(originDir);
    await cloneAndSeed(originDir, hostDir);

    const outcome = await withPublishCheckout(
      { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
      async (root) => {
        await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
        return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
      },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    expect(outcome.committed).toBe(true);
  });

  it('serializes concurrent callers via the lock, returning stage "lock" when exhausted', async () => {
    const originDir = resolve(tmp, 'origin5.git');
    const hostDir = resolve(tmp, 'host5');
    const checkoutDir = resolve(tmp, 'checkout5');

    await makeBareOrigin(originDir);
    await cloneAndSeed(originDir, hostDir);
    await mkdir(`${checkoutDir}.lock`, { recursive: true });

    const outcome = await withPublishCheckout(
      { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main', lockTimeoutMs: 10 * 60 * 1000 },
      async (root) => {
        await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
        return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.stage).toBe('lock');
  }, 70_000);
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
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

// Stands in for the real scripts/sync-local-main.sh (tests/sync-local-main.test.ts covers that one)
// in a temp hostRoot. Mode 0644 on purpose: it only runs if withPublishCheckout calls it via `bash`.
async function writeSyncStub(hostDir: string, body: string): Promise<void> {
  await mkdir(join(hostDir, 'scripts'), { recursive: true });
  await writeFile(join(hostDir, 'scripts', 'sync-local-main.sh'), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o644 });
}

// A stub that records how it was called (argv, cwd, BILKO_SYNC_REPO_ROOT, whether the publish
// lock is still held, origin's main at call time), then logs stderrLines and exits with exitCode.
function recordingStub(
  recordFile: string,
  lockDir: string,
  originDir: string,
  stderrLines: string[],
  exitCode: number,
): string {
  return [
    '{',
    '  printf "argc=%s\\n" "$#"',
    '  printf "args=%s\\n" "$*"',
    '  printf "cwd=%s\\n" "$(pwd -P)"',
    '  printf "root=%s\\n" "${BILKO_SYNC_REPO_ROOT:-}"',
    `  if [ -d '${lockDir}' ]; then echo lock=held; else echo lock=released; fi`,
    `  printf "origin=%s\\n" "$(git --git-dir='${originDir}' rev-parse main)"`,
    `} > '${recordFile}'`,
    ...stderrLines.map((line) => `echo '${line}' >&2`),
    `exit ${exitCode}`,
  ].join('\n');
}

async function readRecord(file: string): Promise<Record<string, string>> {
  const text = await readFile(file, 'utf8');
  return Object.fromEntries(
    text.trim().split('\n').map((line) => {
      const eq = line.indexOf('=');
      return [line.slice(0, eq), line.slice(eq + 1)];
    }),
  );
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
    // hostDir has no scripts/sync-local-main.sh, so no local-main catch-up ran.
    expect(outcome.localMain).toBeUndefined();

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
      { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main', lockTimeoutMs: 10 * 60 * 1000, lockWaitMs: 500 },
      async (root) => {
        await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
        return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
      },
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.stage).toBe('lock');
  });

  it('acquires a lock that another holder releases mid-wait', async () => {
    const originDir = resolve(tmp, 'origin6.git');
    const hostDir = resolve(tmp, 'host6');
    const checkoutDir = resolve(tmp, 'checkout6');

    await makeBareOrigin(originDir);
    await cloneAndSeed(originDir, hostDir);
    await mkdir(`${checkoutDir}.lock`, { recursive: true });
    const release = setTimeout(() => {
      void rm(`${checkoutDir}.lock`, { recursive: true, force: true });
    }, 200);

    try {
      const outcome = await withPublishCheckout(
        { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main', lockTimeoutMs: 10 * 60 * 1000, lockWaitMs: 2000 },
        async (root) => {
          await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
          return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
        },
      );

      expect(outcome.ok).toBe(true);
    } finally {
      clearTimeout(release);
    }
  });

  describe('local-main catch-up after the push', () => {
    it('runs `bash <hostRoot>/scripts/sync-local-main.sh --no-push` from hostRoot once the push has landed', async () => {
      const originDir = resolve(tmp, 'origin7.git');
      const hostDir = resolve(tmp, 'host7');
      const checkoutDir = resolve(tmp, 'checkout7');
      const recordFile = resolve(tmp, 'sync-call7.txt');

      await makeBareOrigin(originDir);
      await cloneAndSeed(originDir, hostDir);
      await writeSyncStub(
        hostDir,
        recordingStub(recordFile, `${checkoutDir}.lock`, originDir, [
          '[sync-local-main] local main: 0 commit(s) to keep on top in order',
          '[sync-local-main] fast-forwarded to 0123abcd',
        ], 0),
      );

      const outcome = await withPublishCheckout(
        { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
        async (root) => {
          await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
          return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
        },
      );

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error(`expected success, got stage=${outcome.stage} error=${outcome.error}`);
      expect(outcome.committed).toBe(true);
      expect(outcome.sha).toBeTruthy();
      expect(outcome.localMain).toEqual({
        synced: true,
        exitCode: 0,
        detail: '[sync-local-main] fast-forwarded to 0123abcd',
      });

      const call = await readRecord(recordFile);
      expect(call.argc).toBe('1');
      expect(call.args).toBe('--no-push');
      expect(call.cwd).toBe(realpathSync(hostDir));
      expect(call.root).toBe(hostDir);
      // Our commit was already on origin when the catch-up ran, and the publish lock was free.
      expect(call.origin).toBe(outcome.sha);
      expect(call.lock).toBe('released');
    });

    it('a failing catch-up leaves ok, committed and sha alone and reports localMain.synced false', async () => {
      const originDir = resolve(tmp, 'origin8.git');
      const hostDir = resolve(tmp, 'host8');
      const checkoutDir = resolve(tmp, 'checkout8');

      await makeBareOrigin(originDir);
      await cloneAndSeed(originDir, hostDir);
      await writeSyncStub(
        hostDir,
        [
          "echo '[sync-local-main] local main: 2 commit(s) to keep on top in order' >&2",
          "echo '[sync-local-main] error: HEAD is not on branch main' >&2",
          'exit 3',
        ].join('\n'),
      );

      const outcome = await withPublishCheckout(
        { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
        async (root) => {
          await writeFile(join(root, 'fileB.txt'), 'built output\n', 'utf8');
          return { result: 'ok', paths: ['fileB.txt'], message: 'publish fileB' };
        },
      );

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error(`expected success, got stage=${outcome.stage} error=${outcome.error}`);
      expect(outcome.committed).toBe(true);
      expect(outcome.result).toBe('ok');
      expect(outcome.sha).toBe((await git(originDir, ['rev-parse', 'main'])).stdout.trim());
      expect(outcome.localMain).toEqual({
        synced: false,
        exitCode: 3,
        detail: '[sync-local-main] error: HEAD is not on branch main',
      });
      expect(existsSync(`${checkoutDir}.lock`)).toBe(false);
    });

    it('does not run the catch-up when there was nothing to commit', async () => {
      const originDir = resolve(tmp, 'origin9.git');
      const hostDir = resolve(tmp, 'host9');
      const checkoutDir = resolve(tmp, 'checkout9');
      const recordFile = resolve(tmp, 'sync-call9.txt');

      await makeBareOrigin(originDir);
      await cloneAndSeed(originDir, hostDir);
      await writeSyncStub(hostDir, recordingStub(recordFile, `${checkoutDir}.lock`, originDir, [], 0));

      const outcome = await withPublishCheckout(
        { hostRoot: hostDir, checkoutDir, remote: 'origin', branch: 'main' },
        async () => ({ result: 'noop', paths: ['fileA.txt'], message: 'no real change' }),
      );

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error('unreachable');
      expect(outcome.committed).toBe(false);
      expect(outcome.localMain).toBeUndefined();
      expect(existsSync(recordFile)).toBe(false);
    });
  });
});

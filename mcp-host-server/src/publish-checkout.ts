/**
 * Standalone git-publish primitive for the bilko-host MCP.
 *
 * Does all git work (sync, commit, push) in a dedicated worktree checkout
 * kept in sync with <remote>/<branch>, never in the human's main checkout.
 * This avoids committing another process's unstaged/staged work and avoids
 * pushing a branch other than the one the checkout is actually synced to.
 *
 * Imports no MCP SDK and no fastify — this file is a pure git/process module.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, rmdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const exec = promisify(execFile);

export interface PublishCheckoutOptions {
  hostRoot: string;
  checkoutDir?: string;
  remote?: string;
  branch?: string;
  lockTimeoutMs?: number;
}

export interface PublishFnResult<T> {
  result: T;
  paths: string[];
  message: string;
}

export type PublishOutcome<T> =
  | { ok: true; result: T; committed: boolean; sha?: string }
  | { ok: false; stage: 'lock' | 'sync' | 'commit' | 'push'; error: string };

const DEFAULT_REMOTE = 'origin';
const DEFAULT_BRANCH = 'main';
const DEFAULT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const LOCK_WAIT_TIMEOUT_MS = 60 * 1000;
const LOCK_POLL_INTERVAL_MS = 250;
const MAX_PUSH_ATTEMPTS = 3;
const SHORT_TIMEOUT_MS = 60 * 1000;
const LONG_TIMEOUT_MS = 120 * 1000;

function defaultCheckoutDir(): string {
  return (
    process.env.BILKO_PUBLISH_CHECKOUT ||
    resolve(homedir(), '.local/state/bilko-host/publish-checkout')
  );
}

async function hasGitIdentity(cwd: string): Promise<boolean> {
  try {
    await exec('git', ['config', 'user.email'], { cwd, timeout: SHORT_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

async function git(
  cwd: string,
  args: string[],
  opts: { timeout?: number; withIdentity?: boolean } = {},
): Promise<{ stdout: string; stderr: string }> {
  let fullArgs = args;
  if (opts.withIdentity && !(await hasGitIdentity(cwd))) {
    fullArgs = [
      '-c',
      'user.name=bilko-host-publisher',
      '-c',
      'user.email=bilko-host-publisher@bilko.run',
      ...args,
    ];
  }
  return exec('git', fullArgs, { cwd, timeout: opts.timeout ?? SHORT_TIMEOUT_MS });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireLock(lockDir: string, lockTimeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  for (;;) {
    try {
      await mkdir(lockDir);
      return true;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    // Lock dir exists — check staleness.
    try {
      const st = statSync(lockDir);
      if (Date.now() - st.mtimeMs > lockTimeoutMs) {
        await rmdir(lockDir).catch(() => {});
        continue;
      }
    } catch {
      // Lock dir vanished between mkdir failure and stat — retry immediately.
      continue;
    }
    if (Date.now() >= deadline) return false;
    await sleep(LOCK_POLL_INTERVAL_MS);
  }
}

async function releaseLock(lockDir: string): Promise<void> {
  await rmdir(lockDir).catch(() => {});
}

async function ensureCheckout(
  hostRoot: string,
  checkoutDir: string,
): Promise<void> {
  if (existsSync(checkoutDir)) return;
  await mkdir(resolve(checkoutDir, '..'), { recursive: true });
  await git(hostRoot, ['worktree', 'add', '--detach', checkoutDir], {
    timeout: LONG_TIMEOUT_MS,
  });
}

async function syncCheckout(
  checkoutDir: string,
  remote: string,
  branch: string,
): Promise<void> {
  await git(checkoutDir, ['fetch', remote, branch], { timeout: LONG_TIMEOUT_MS });
  await git(checkoutDir, ['reset', '--hard', `${remote}/${branch}`]);
  await git(checkoutDir, ['clean', '-fd']);
}

export async function withPublishCheckout<T>(
  opts: PublishCheckoutOptions,
  fn: (root: string) => Promise<PublishFnResult<T>>,
): Promise<PublishOutcome<T>> {
  const hostRoot = opts.hostRoot;
  const checkoutDir = opts.checkoutDir ?? defaultCheckoutDir();
  const remote = opts.remote ?? DEFAULT_REMOTE;
  const branch = opts.branch ?? DEFAULT_BRANCH;
  const lockTimeoutMs = opts.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const lockDir = `${checkoutDir}.lock`;

  // The lock sits beside the checkout, so its parent must exist before
  // acquireLock's non-recursive mkdir (fresh machines have no state dir yet).
  await mkdir(resolve(checkoutDir, '..'), { recursive: true });
  const gotLock = await acquireLock(lockDir, lockTimeoutMs);
  if (!gotLock) {
    return { ok: false, stage: 'lock', error: `timed out waiting for publish lock at ${lockDir}` };
  }

  try {
    try {
      await ensureCheckout(hostRoot, checkoutDir);
      await syncCheckout(checkoutDir, remote, branch);
    } catch (e: unknown) {
      return { ok: false, stage: 'sync', error: (e as Error).message };
    }

    let fnOut: PublishFnResult<T>;
    try {
      fnOut = await fn(checkoutDir);
    } catch (e: unknown) {
      return { ok: false, stage: 'commit', error: (e as Error).message };
    }

    const { result, paths, message } = fnOut;

    let committed = false;
    let sha: string | undefined;
    try {
      if (paths.length > 0) {
        await git(checkoutDir, ['add', '-A', '--', ...paths]);
      }
      const { stdout: status } = await git(checkoutDir, [
        'status',
        '--porcelain',
        '--',
        ...paths,
      ]);
      if (status.trim()) {
        await git(checkoutDir, ['commit', '-m', message, '--', ...paths], {
          withIdentity: true,
        });
        committed = true;
        const { stdout: headSha } = await git(checkoutDir, ['rev-parse', 'HEAD']);
        sha = headSha.trim();
      }
    } catch (e: unknown) {
      return { ok: false, stage: 'commit', error: (e as Error).message };
    }

    if (!committed) {
      return { ok: true, result, committed: false };
    }

    for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
      try {
        await git(checkoutDir, ['push', remote, `HEAD:refs/heads/${branch}`], {
          timeout: LONG_TIMEOUT_MS,
        });
        return { ok: true, result, committed: true, sha };
      } catch (pushErr: unknown) {
        if (attempt === MAX_PUSH_ATTEMPTS) {
          return { ok: false, stage: 'push', error: (pushErr as Error).message };
        }
        try {
          await git(checkoutDir, ['fetch', remote, branch], { timeout: LONG_TIMEOUT_MS });
          await git(checkoutDir, ['rebase', `${remote}/${branch}`]);
        } catch (rebaseErr: unknown) {
          return { ok: false, stage: 'push', error: (rebaseErr as Error).message };
        }
      }
    }
    // Unreachable: loop always returns.
    return { ok: false, stage: 'push', error: 'push retries exhausted' };
  } finally {
    await releaseLock(lockDir);
  }
}

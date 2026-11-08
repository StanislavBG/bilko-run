/**
 * Standalone git-publish primitive for the bilko-host MCP.
 *
 * Does all git work (sync, commit, push) in a dedicated worktree checkout
 * kept in sync with <remote>/<branch>, never in the human's main checkout.
 * This avoids committing another process's unstaged/staged work and avoids
 * pushing a branch other than the one the checkout is actually synced to.
 * After a push lands it runs the host's scripts/sync-local-main.sh --no-push,
 * best effort, so the live checkout's local main does not fall behind origin.
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
const DEFAULT_REMOTE = 'origin';
const DEFAULT_BRANCH = 'main';
const DEFAULT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const LOCK_WAIT_TIMEOUT_MS = 60 * 1000;
const LOCK_POLL_INTERVAL_MS = 250;
const MAX_PUSH_ATTEMPTS = 3;
const SHORT_TIMEOUT_MS = 60 * 1000;
const LONG_TIMEOUT_MS = 120 * 1000;
const SYNC_LOCAL_MAIN_SCRIPT = 'scripts/sync-local-main.sh';
// The script waits up to 120s for .git/blog-seed.lock before it fetches; 180s leaves it room.
const SYNC_LOCAL_MAIN_TIMEOUT_MS = 180 * 1000;
function defaultCheckoutDir() {
    return (process.env.BILKO_PUBLISH_CHECKOUT ||
        resolve(homedir(), '.local/state/bilko-host/publish-checkout'));
}
async function hasGitIdentity(cwd) {
    try {
        await exec('git', ['config', 'user.email'], { cwd, timeout: SHORT_TIMEOUT_MS });
        return true;
    }
    catch {
        return false;
    }
}
async function git(cwd, args, opts = {}) {
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
async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function acquireLock(lockDir, lockTimeoutMs, lockWaitMs) {
    const deadline = Date.now() + lockWaitMs;
    for (;;) {
        try {
            await mkdir(lockDir);
            return true;
        }
        catch (e) {
            if (e.code !== 'EEXIST')
                throw e;
        }
        // Lock dir exists — check staleness.
        try {
            const st = statSync(lockDir);
            if (Date.now() - st.mtimeMs > lockTimeoutMs) {
                await rmdir(lockDir).catch(() => { });
                continue;
            }
        }
        catch {
            // Lock dir vanished between mkdir failure and stat — retry immediately.
            continue;
        }
        if (Date.now() >= deadline)
            return false;
        await sleep(LOCK_POLL_INTERVAL_MS);
    }
}
async function releaseLock(lockDir) {
    await rmdir(lockDir).catch(() => { });
}
async function ensureCheckout(hostRoot, checkoutDir) {
    if (existsSync(checkoutDir))
        return;
    await mkdir(resolve(checkoutDir, '..'), { recursive: true });
    await git(hostRoot, ['worktree', 'add', '--detach', checkoutDir], {
        timeout: LONG_TIMEOUT_MS,
    });
}
async function syncCheckout(checkoutDir, remote, branch) {
    await git(checkoutDir, ['fetch', remote, branch], { timeout: LONG_TIMEOUT_MS });
    await git(checkoutDir, ['reset', '--hard', `${remote}/${branch}`]);
    await git(checkoutDir, ['clean', '-fd']);
}
function lastLine(text) {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    return lines[lines.length - 1] ?? '';
}
/**
 * Catches the live checkout's local main up to origin/main after our push, which landed from the
 * publish checkout and so left it behind. Runs `bash <hostRoot>/scripts/sync-local-main.sh
 * --no-push`: it never pushes, and it takes .git/blog-seed.lock itself. Best effort: returns a
 * report and never throws. Returns undefined when hostRoot has no such script. execFile captures
 * the script's output, so none of it reaches the MCP server's stdio protocol stream.
 */
async function catchUpLocalMain(hostRoot) {
    const script = resolve(hostRoot, SYNC_LOCAL_MAIN_SCRIPT);
    if (!existsSync(script))
        return undefined;
    try {
        const { stderr } = await exec('bash', [script, '--no-push'], {
            cwd: hostRoot,
            timeout: SYNC_LOCAL_MAIN_TIMEOUT_MS,
            // Pin the checkout to sync; the script would otherwise honor one inherited from our env.
            env: { ...process.env, BILKO_SYNC_REPO_ROOT: hostRoot },
        });
        return { synced: true, exitCode: 0, detail: lastLine(stderr) };
    }
    catch (e) {
        const failure = e;
        const last = lastLine(failure.stderr ?? '');
        let detail = last || lastLine(failure.message);
        if (failure.killed) {
            // Killed at the timeout: the last stderr line is only progress, so say what happened.
            detail = `timed out after ${SYNC_LOCAL_MAIN_TIMEOUT_MS / 1000}s${last ? ` (last: ${last})` : ''}`;
        }
        return {
            synced: false,
            exitCode: typeof failure.code === 'number' ? failure.code : null,
            detail,
        };
    }
}
export async function withPublishCheckout(opts, fn) {
    const hostRoot = opts.hostRoot;
    const checkoutDir = opts.checkoutDir ?? defaultCheckoutDir();
    const remote = opts.remote ?? DEFAULT_REMOTE;
    const branch = opts.branch ?? DEFAULT_BRANCH;
    const lockTimeoutMs = opts.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    const lockDir = `${checkoutDir}.lock`;
    // The lock sits beside the checkout, so its parent must exist before
    // acquireLock's non-recursive mkdir (fresh machines have no state dir yet).
    await mkdir(resolve(checkoutDir, '..'), { recursive: true });
    const gotLock = await acquireLock(lockDir, lockTimeoutMs, opts.lockWaitMs ?? LOCK_WAIT_TIMEOUT_MS);
    if (!gotLock) {
        return { ok: false, stage: 'lock', error: `timed out waiting for publish lock at ${lockDir}` };
    }
    let outcome;
    try {
        outcome = await publishUnderLock(hostRoot, checkoutDir, remote, branch, fn);
    }
    finally {
        await releaseLock(lockDir);
    }
    // Only a push that landed leaves local main behind; nothing to catch up otherwise.
    if (!outcome.ok || !outcome.committed)
        return outcome;
    // The publish lock is released BEFORE the catch-up. The catch-up touches only the live checkout
    // and can wait up to 120s on .git/blog-seed.lock, so holding the publish lock through it would
    // make the next publish time out at stage 'lock' over a best-effort step. This call still
    // awaits it, so the outcome (and the tests) see a finished catch-up either way.
    const localMain = await catchUpLocalMain(hostRoot);
    return localMain ? { ...outcome, localMain } : outcome;
}
/** Everything withPublishCheckout does while holding the publish lock: sync, fn, commit, push. */
async function publishUnderLock(hostRoot, checkoutDir, remote, branch, fn) {
    try {
        await ensureCheckout(hostRoot, checkoutDir);
        await syncCheckout(checkoutDir, remote, branch);
    }
    catch (e) {
        return { ok: false, stage: 'sync', error: e.message };
    }
    let fnOut;
    try {
        fnOut = await fn(checkoutDir);
    }
    catch (e) {
        return { ok: false, stage: 'commit', error: e.message };
    }
    const { result, paths, message } = fnOut;
    let committed = false;
    let sha;
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
    }
    catch (e) {
        return { ok: false, stage: 'commit', error: e.message };
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
        }
        catch (pushErr) {
            if (attempt === MAX_PUSH_ATTEMPTS) {
                return { ok: false, stage: 'push', error: pushErr.message };
            }
            try {
                await git(checkoutDir, ['fetch', remote, branch], { timeout: LONG_TIMEOUT_MS });
                await git(checkoutDir, ['rebase', `${remote}/${branch}`]);
            }
            catch (rebaseErr) {
                return { ok: false, stage: 'push', error: rebaseErr.message };
            }
        }
    }
    // Unreachable: loop always returns.
    return { ok: false, stage: 'push', error: 'push retries exhausted' };
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs scripts/sync-local-main.sh against a temp repo with a bare-repo origin. Guards the publish
// boundary: only plan records may be pushed, unshipped product commits stay local, and --no-push
// (what publishers run right after their own push) never runs git push at all.
const SCRIPT = join(__dirname, '..', 'scripts/sync-local-main.sh');
const RECORD = 'session-manager-operations/reviews/deploy/epic-1/ship.md';
const USAGE = 'usage: bash scripts/sync-local-main.sh [--dry-run] [--no-push]';

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

describe('sync-local-main.sh', () => {
  let tmp: string;
  let repo: string;
  let origin: string;
  let other: string;

  const write = (dir: string, rel: string, text: string) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };
  const commit = (dir: string, rel: string, text: string, msg: string) => {
    write(dir, rel, text);
    git(dir, 'add', '--', rel);
    git(dir, 'commit', '-qm', msg);
    return git(dir, 'rev-parse', 'HEAD');
  };
  // The script reaches git through tmp/bin/git, a shim that logs every call to tmp/git.log and runs
  // tmp/mid-run.sh once, if a test wrote it, just before the sync creates its throwaway worktree.
  const run = (...args: string[]) =>
    spawnSync('env', ['-i', `HOME=${tmp}`, `PATH=${join(tmp, 'bin')}:/usr/bin:/bin`, `BILKO_SYNC_REPO_ROOT=${repo}`,
      'GIT_AUTHOR_NAME=T', 'GIT_AUTHOR_EMAIL=t@example.com', 'GIT_COMMITTER_NAME=T', 'GIT_COMMITTER_EMAIL=t@example.com',
      'bash', SCRIPT, ...args], { encoding: 'utf-8', timeout: 60_000 });
  const gitCalls = () => {
    const log = join(tmp, 'git.log');
    return existsSync(log) ? readFileSync(log, 'utf-8').split('\n').filter(Boolean) : [];
  };
  const pushes = () => gitCalls().filter((call) => /(^| )push( |$)/.test(call));
  const ahead = () => git(repo, 'rev-list', '--count', 'origin/main..main');
  const behind = () => git(repo, 'rev-list', '--count', 'main..origin/main');

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'sync-main-'));
    origin = join(tmp, 'StanislavBG', 'bilko-run.git');
    repo = join(tmp, 'repo');
    other = join(tmp, 'other');
    mkdirSync(origin, { recursive: true });
    git(origin, 'init', '--bare', '-q', '-b', 'main');
    mkdirSync(repo);
    git(repo, 'init', '-q', '-b', 'main');
    for (const d of [repo]) {
      git(d, 'config', 'user.name', 'T');
      git(d, 'config', 'user.email', 't@example.com');
    }
    write(repo, 'CLAUDE.md', 'base\n');
    write(repo, 'scheduler-state.json', '{}\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-qm', 'init');
    git(repo, 'remote', 'add', 'origin', origin);
    git(repo, 'push', '-q', '-u', 'origin', 'main');
    git(tmp, 'clone', '-q', origin, other);
    git(other, 'config', 'user.name', 'T');
    git(other, 'config', 'user.email', 't@example.com');
    const hook = join(tmp, 'mid-run.sh');
    mkdirSync(join(tmp, 'bin'));
    writeFileSync(join(tmp, 'bin', 'git'), [
      '#!/bin/sh',
      `printf '%s\\n' "$*" >> '${join(tmp, 'git.log')}'`,
      `case " $* " in *" worktree add "*) if [ -f '${hook}' ]; then mv '${hook}' '${hook}.ran'; sh '${hook}.ran'; fi ;; esac`,
      'PATH=/usr/bin:/bin; export PATH',
      'exec git "$@"',
      '',
    ].join('\n'), { mode: 0o755 });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('does nothing when local main matches origin/main, and fast-forwards when it is only behind', () => {
    expect(run().status).toBe(0);
    commit(other, 'content/blog/post.md', 'post\n', 'feat(blog): publish post');
    git(other, 'push', '-q', 'origin', 'main');
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    expect(git(repo, 'rev-parse', 'main')).toBe(git(origin, 'rev-parse', 'main'));
  });

  it('diverged: pushes only the records, drops shipped twins, keeps unshipped work on top', () => {
    // A ship cherry-picked the feature onto origin (a twin); a blog post landed there too.
    commit(repo, 'server/feature.ts', 'feature\n', 'feat: the feature');
    const recordSha = commit(repo, RECORD, 'SHIP: PASS\n', 'docs(deploy): record the ship');
    const unshipped = commit(repo, 'server/next.ts', 'next\n', 'feat: not validated yet');
    commit(other, 'server/feature.ts', 'feature\n', 'feat: the feature');
    commit(other, 'content/blog/post.md', 'post\n', 'feat(blog): publish post');
    git(other, 'push', '-q', 'origin', 'main');
    write(repo, 'scheduler-state.json', '{"dirty":true}\n');
    const originBefore = git(origin, 'rev-parse', 'main');

    const r = run();
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toBe(''); // logs go to stderr only, push output included
    expect(pushes()).toHaveLength(1); // the shim sees the script's pushes
    const originAfter = git(origin, 'rev-parse', 'main');
    expect(git(origin, 'rev-list', '--count', `${originBefore}..${originAfter}`)).toBe('1');
    expect(git(origin, 'show', '--name-only', '--format=', originAfter)).toBe(RECORD);
    expect(spawnSync('git', ['cat-file', '-e', `${originAfter}:server/next.ts`], { cwd: origin }).status).not.toBe(0);

    git(repo, 'fetch', '-q', 'origin');
    expect(behind()).toBe('0');
    expect(ahead()).toBe('1');
    expect(git(repo, 'log', '-1', '--format=%s', 'main')).toBe('feat: not validated yet');
    expect(readFileSync(join(repo, 'server/next.ts'), 'utf-8')).toBe('next\n');
    expect(readFileSync(join(repo, 'content/blog/post.md'), 'utf-8')).toBe('post\n');
    expect(readFileSync(join(repo, 'scheduler-state.json'), 'utf-8')).toBe('{"dirty":true}\n');
    expect(git(repo, 'rev-parse', 'backup/main-pre-sync')).toBe(unshipped);
    expect(git(repo, 'log', '--format=%s', 'origin/main')).toContain('docs(deploy): record the ship');
    expect(recordSha).not.toBe(originAfter);
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
  });

  it('exit 3 and nothing changes when a local commit conflicts with origin/main', () => {
    const local = commit(repo, 'CLAUDE.md', 'local\n', 'docs: local shape');
    commit(other, 'CLAUDE.md', 'origin\n', 'docs: origin shape');
    git(other, 'push', '-q', 'origin', 'main');
    const originBefore = git(origin, 'rev-parse', 'main');
    const r = run();
    expect(r.status).toBe(3);
    expect(git(repo, 'rev-parse', 'main')).toBe(local);
    expect(git(origin, 'rev-parse', 'main')).toBe(originBefore);
    expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf-8')).toBe('local\n');
  });

  it('--dry-run changes nothing', () => {
    commit(repo, RECORD, 'SHIP: PASS\n', 'docs(deploy): record the ship');
    commit(other, 'content/blog/post.md', 'post\n', 'feat(blog): publish post');
    git(other, 'push', '-q', 'origin', 'main');
    const before = { local: git(repo, 'rev-parse', 'main'), origin: git(origin, 'rev-parse', 'main') };
    const r = run('--dry-run');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain('would push 1 record commit(s)');
    expect(git(repo, 'rev-parse', 'main')).toBe(before.local);
    expect(git(origin, 'rev-parse', 'main')).toBe(before.origin);
  });

  const backupAbsent = () =>
    spawnSync('git', ['rev-parse', '-q', '--verify', 'refs/heads/backup/main-pre-sync'], { cwd: repo }).status !== 0;

  it('strictly ahead with only unshipped commits: exit 0, nothing moves', () => {
    commit(repo, 'server/a.ts', 'a\n', 'feat: a');
    commit(repo, 'server/b.ts', 'b\n', 'feat: b');
    const localBefore = git(repo, 'rev-parse', 'main');
    const originBefore = git(origin, 'rev-parse', 'main');
    for (const args of [['--dry-run'], []]) {
      const r = run(...args);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).toContain('nothing to do');
      git(repo, 'fetch', '-q', 'origin');
      expect(git(repo, 'rev-parse', 'main')).toBe(localBefore);
      expect(git(repo, 'rev-parse', 'origin/main')).toBe(originBefore);
      expect(backupAbsent()).toBe(true);
    }
  });

  it('records directly on origin/main keep their shas', () => {
    const r1 = commit(repo, RECORD, 'SHIP: PASS\n', 'docs(deploy): record the ship');
    const o = commit(repo, 'server/o.ts', 'o\n', 'feat: o');
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    git(repo, 'fetch', '-q', 'origin');
    expect(git(repo, 'rev-parse', 'origin/main')).toBe(r1);
    expect(git(repo, 'rev-parse', 'main')).toBe(o);
    expect(backupAbsent()).toBe(true);
  });

  it('an unknown flag exits 1 with the usage line, before the lock or any git command', () => {
    for (const args of [['--bogus'], ['--no-push', '--bogus'], ['--bogus', '--dry-run']]) {
      const r = run(...args);
      expect(r.status).toBe(1);
      expect(r.stdout).toBe('');
      expect(r.stderr.trim()).toBe(USAGE);
    }
    expect(gitCalls()).toEqual([]);
    expect(existsSync(join(repo, '.git', 'blog-seed.lock'))).toBe(false);
  });

  // Publishers run --no-push right after their own push. It must never push: not the records, not
  // anyone's unshipped work. Each case also checks the contract that callers outside this repo
  // rely on (exit codes, stderr-only logging).
  describe('--no-push', () => {
    const originRefs = () => git(origin, 'for-each-ref');
    const subjectsAhead = () => git(repo, 'log', '--reverse', '--format=%s', 'origin/main..main').split('\n');

    it('diverged: drops the twins, keeps the unshipped and record commits on top in order, pushes nothing', () => {
      // 2026-11-07: Burrow's blog withdraw and the blog seed each pushed from a worktree and
      // cherry-picked a twin onto local main, and the bilko-host publisher pushed a third commit.
      commit(other, 'content/blog/withdrawn.md', 'withdrawn\n', 'feat(blog): withdraw a post');
      commit(other, 'content/blog/seed.md', 'seed\n', 'feat(blog): seed a post');
      commit(other, 'public/projects/app/index.html', 'app\n', 'feat(projects): publish app');
      git(other, 'push', '-q', 'origin', 'main');
      commit(repo, 'server/next.ts', 'next\n', 'feat: not validated yet');
      commit(repo, 'content/blog/withdrawn.md', 'withdrawn\n', 'feat(blog): withdraw a post');
      commit(repo, RECORD, 'SHIP: PASS\n', 'docs(deploy): record the ship');
      const oldTip = commit(repo, 'content/blog/seed.md', 'seed\n', 'feat(blog): seed a post');
      write(repo, 'scheduler-state.json', '{"dirty":true}\n');
      const refsBefore = originRefs();

      const r = run('--no-push');
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toBe('');
      expect(gitCalls()).toContain('fetch -q origin main'); // the shim saw the script's git calls
      expect(pushes()).toEqual([]);
      expect(originRefs()).toBe(refsBefore);
      const tip = git(repo, 'rev-parse', 'main');
      expect(spawnSync('git', ['cat-file', '-e', tip], { cwd: origin }).status).not.toBe(0);

      git(repo, 'fetch', '-q', 'origin');
      expect(behind()).toBe('0');
      expect(ahead()).toBe('2');
      expect(subjectsAhead()).toEqual(['feat: not validated yet', 'docs(deploy): record the ship']);
      expect(readFileSync(join(repo, 'server/next.ts'), 'utf-8')).toBe('next\n');
      expect(readFileSync(join(repo, RECORD), 'utf-8')).toBe('SHIP: PASS\n');
      expect(readFileSync(join(repo, 'content/blog/withdrawn.md'), 'utf-8')).toBe('withdrawn\n');
      expect(readFileSync(join(repo, 'content/blog/seed.md'), 'utf-8')).toBe('seed\n');
      expect(readFileSync(join(repo, 'public/projects/app/index.html'), 'utf-8')).toBe('app\n');
      expect(readFileSync(join(repo, 'scheduler-state.json'), 'utf-8')).toBe('{"dirty":true}\n');
      expect(git(repo, 'rev-parse', 'backup/main-pre-sync')).toBe(oldTip);
      expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
    });

    it('behind only: a dirty file in the way exits 1, then a clean tree fast-forwards; pushes nothing', () => {
      commit(other, 'CLAUDE.md', 'origin\n', 'docs: origin shape');
      git(other, 'push', '-q', 'origin', 'main');
      const local = git(repo, 'rev-parse', 'main');
      write(repo, 'CLAUDE.md', 'dirty\n');
      const blocked = run('--no-push');
      expect(blocked.status).toBe(1);
      expect(blocked.stdout).toBe('');
      expect(git(repo, 'rev-parse', 'main')).toBe(local);
      expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf-8')).toBe('dirty\n');

      git(repo, 'checkout', '--', 'CLAUDE.md');
      const r = run('--no-push');
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toBe('');
      expect(git(repo, 'rev-parse', 'main')).toBe(git(origin, 'rev-parse', 'main'));
      expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf-8')).toBe('origin\n');
      expect(pushes()).toEqual([]);
      expect(backupAbsent()).toBe(true);
    });

    it('strictly ahead, a record commit included: exit 0, no reset, no backup overwrite, nothing pushed', () => {
      const earlier = git(repo, 'rev-parse', 'main');
      git(repo, 'branch', 'backup/main-pre-sync', earlier); // left by an earlier sync
      commit(repo, RECORD, 'SHIP: PASS\n', 'docs(deploy): record the ship');
      commit(repo, 'server/a.ts', 'a\n', 'feat: a');
      const localBefore = git(repo, 'rev-parse', 'main');
      const refsBefore = originRefs();
      for (const args of [['--no-push'], ['--no-push', '--dry-run'], ['--dry-run', '--no-push']]) {
        const r = run(...args);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('');
        expect(r.stderr).toContain('nothing to do');
        expect(git(repo, 'rev-parse', 'main')).toBe(localBefore);
        expect(git(repo, 'rev-parse', 'backup/main-pre-sync')).toBe(earlier);
      }
      expect(gitCalls().filter((call) => /(^| )reset( |$)/.test(call))).toEqual([]);
      expect(pushes()).toEqual([]);
      expect(originRefs()).toBe(refsBefore);
    });

    it('merge commits not on origin/main: exit 3, local main untouched, nothing pushed', () => {
      git(repo, 'checkout', '-q', '-b', 'side');
      commit(repo, 'server/side.ts', 'side\n', 'feat: side');
      git(repo, 'checkout', '-q', 'main');
      commit(repo, 'server/main.ts', 'main\n', 'feat: main');
      git(repo, 'merge', '-q', '--no-ff', '-m', 'merge side', 'side');
      commit(other, 'content/blog/post.md', 'post\n', 'feat(blog): publish post');
      git(other, 'push', '-q', 'origin', 'main');
      const local = git(repo, 'rev-parse', 'main');
      const refsBefore = originRefs();
      const r = run('--no-push');
      expect(r.status).toBe(3);
      expect(r.stdout).toBe('');
      expect(r.stderr).toContain('merge commits');
      expect(git(repo, 'rev-parse', 'main')).toBe(local);
      expect(pushes()).toEqual([]);
      expect(originRefs()).toBe(refsBefore);
      expect(backupAbsent()).toBe(true);
    });

    it('a replay that conflicts: exit 3, local main and its files untouched, nothing pushed', () => {
      const local = commit(repo, 'CLAUDE.md', 'local\n', 'docs: local shape');
      commit(other, 'CLAUDE.md', 'origin\n', 'docs: origin shape');
      git(other, 'push', '-q', 'origin', 'main');
      const refsBefore = originRefs();
      const r = run('--no-push');
      expect(r.status).toBe(3);
      expect(r.stdout).toBe('');
      expect(r.stderr).toContain('does not apply on origin/main');
      expect(git(repo, 'rev-parse', 'main')).toBe(local);
      expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf-8')).toBe('local\n');
      expect(pushes()).toEqual([]);
      expect(originRefs()).toBe(refsBefore);
      expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
    });

    it('diverged with a dirty file the sync must update: exit 1, local main and the file untouched', () => {
      const local = commit(repo, 'server/next.ts', 'next\n', 'feat: not validated yet');
      commit(other, 'CLAUDE.md', 'origin\n', 'docs: origin shape');
      git(other, 'push', '-q', 'origin', 'main');
      write(repo, 'CLAUDE.md', 'dirty\n');
      const r = run('--no-push');
      expect(r.status).toBe(1);
      expect(r.stdout).toBe('');
      expect(r.stderr).toContain('uncommitted changes in files the sync must update: CLAUDE.md');
      expect(git(repo, 'rev-parse', 'main')).toBe(local);
      expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf-8')).toBe('dirty\n');
      expect(pushes()).toEqual([]);
      expect(backupAbsent()).toBe(true);
    });

    it('local main moves during the run: exit 1, the new commit stays, nothing pushed', () => {
      commit(repo, 'server/next.ts', 'next\n', 'feat: not validated yet');
      commit(other, 'content/blog/post.md', 'post\n', 'feat(blog): publish post');
      git(other, 'push', '-q', 'origin', 'main');
      // A plan commits to local main while the sync builds its worktree.
      writeFileSync(join(tmp, 'mid-run.sh'), `git -C '${repo}' commit -q --allow-empty -m 'docs: concurrent record'\n`);
      const r = run('--no-push');
      expect(r.status).toBe(1);
      expect(r.stdout).toBe('');
      expect(r.stderr).toContain('local main moved during the sync');
      expect(git(repo, 'log', '-1', '--format=%s', 'main')).toBe('docs: concurrent record');
      expect(pushes()).toEqual([]);
      expect(backupAbsent()).toBe(true);
    });

    it('with --dry-run, in either order: reports what would happen and changes nothing', () => {
      commit(repo, RECORD, 'SHIP: PASS\n', 'docs(deploy): record the ship');
      commit(repo, 'server/next.ts', 'next\n', 'feat: not validated yet');
      commit(other, 'content/blog/post.md', 'post\n', 'feat(blog): publish post');
      git(other, 'push', '-q', 'origin', 'main');
      const local = git(repo, 'rev-parse', 'main');
      const refsBefore = originRefs();
      for (const args of [['--dry-run', '--no-push'], ['--no-push', '--dry-run']]) {
        const r = run(...args);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('');
        expect(r.stderr).toContain('would move local main to 2 commit(s) on top of origin/main and push nothing');
        expect(git(repo, 'rev-parse', 'main')).toBe(local);
        expect(originRefs()).toBe(refsBefore);
        expect(backupAbsent()).toBe(true);
        expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
      }
      expect(pushes()).toEqual([]);
    });
  });
});

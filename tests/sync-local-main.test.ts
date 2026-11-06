import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs scripts/sync-local-main.sh against a temp repo with a bare-repo origin. Guards the publish
// boundary: only plan records may be pushed, unshipped product commits stay local.
const SCRIPT = join(__dirname, '..', 'scripts/sync-local-main.sh');
const RECORD = 'session-manager-operations/reviews/deploy/epic-1/ship.md';

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
  const run = (...args: string[]) =>
    spawnSync('env', ['-i', `HOME=${tmp}`, 'PATH=/usr/bin:/bin', `BILKO_SYNC_REPO_ROOT=${repo}`,
      'GIT_AUTHOR_NAME=T', 'GIT_AUTHOR_EMAIL=t@example.com', 'GIT_COMMITTER_NAME=T', 'GIT_COMMITTER_EMAIL=t@example.com',
      'bash', SCRIPT, ...args], { encoding: 'utf-8', timeout: 60_000 });
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
});

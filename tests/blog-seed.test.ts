import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs scripts/blog-seed.sh against a temp git repo with a bare-repo origin, a fake pnpm
// (stands in for the cadence gate, passes `tsx` through to the real one) and a fake curl.
// Never touches the network or this repo's git history.
const ROOT = join(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts/blog-seed.sh');
const SKILL = '.claude/skills/blog-from-git';
const LEDGER = `${SKILL}/blog-ledger.md`;
const POST = `---\nslug: my-post\ntitle: "My post"\nexcerpt: A short note.\ncategory: product\nproject: outdoor-hours\n---\n\nHuman-edited body, kept as is.\n\n![shot](/blog-images/my-post/shot.jpg "Shot")\n`;

const FAKE_PNPM = `#!/bin/bash
case "$*" in
  *blog-cadence-gate*)
    echo "$*" >> "$FAKE_DIR/gate-calls"
    all="$*"; root="\${all##*--root }"
    [ -f "$root/content/blog/my-post.md" ] && echo "root-has-post" >> "$FAKE_DIR/gate-calls"
    # FAKE_RACE_REPO: another publisher pushes to origin between our fetch and our push, once.
    if [ -n "\${FAKE_RACE_REPO:-}" ] && [ ! -f "$FAKE_DIR/raced" ]; then
      touch "$FAKE_DIR/raced"
      git -C "$FAKE_RACE_REPO" commit -q --allow-empty -m race && git -C "$FAKE_RACE_REPO" push -q origin HEAD:main
    fi
    if [ "\${FAKE_GATE_RC:-0}" = 0 ]; then echo ok; else echo "2026-10-09 -> 2026-10-10: 24.0h apart (min 72h)"; fi
    exit "\${FAKE_GATE_RC:-0}" ;;
  tsx\\ *) shift; exec "$REAL_TSX" "$@" ;;
esac
exit 0
`;
const FAKE_CURL = `#!/bin/bash
if [ -f "$FAKE_CURL_BODY" ]; then cat "$FAKE_CURL_BODY"; else echo '[]'; fi
`;

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

describe('blog-seed.sh', () => {
  let tmp: string;
  let repo: string;
  let origin: string;
  let bundle: string;
  let fake: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'blog-seed-'));
    origin = join(tmp, 'StanislavBG', 'bilko-run.git');
    repo = join(tmp, 'repo');
    bundle = join(tmp, 'bundle');
    fake = join(tmp, 'bin');
    mkdirSync(origin, { recursive: true });
    mkdirSync(repo);
    mkdirSync(fake);
    git(origin, 'init', '--bare', '-b', 'main');

    mkdirSync(join(repo, SKILL), { recursive: true });
    mkdirSync(join(repo, 'content/blog'), { recursive: true });
    mkdirSync(join(repo, 'src/data'), { recursive: true });
    copyFileSync(join(ROOT, SKILL, 'blog.config.yaml'), join(repo, SKILL, 'blog.config.yaml'));
    copyFileSync(join(ROOT, LEDGER), join(repo, LEDGER));
    writeFileSync(join(repo, 'src/data/standalone-projects.json'), '[{"slug":"outdoor-hours","public":true},{"slug":"admin-tool"}]');
    writeFileSync(
      join(repo, 'content/blog/old-post.md'),
      '---\nslug: "old-post"\ntitle: "Old"\nexcerpt: "Old."\ncategory: "product"\npublished: true\npublished_at: "2026-01-01T00:00:00.000Z"\norder: 7\n---\n\nOld body.\n',
    );
    writeFileSync(join(repo, 'unrelated.txt'), 'one\n');
    writeFileSync(join(repo, 'CLAUDE.md'), 'base\n');
    git(repo, 'init', '-b', 'main');
    git(repo, 'config', 'user.name', 'T');
    git(repo, 'config', 'user.email', 't@example.com');
    git(repo, 'remote', 'add', 'origin', origin);
    git(repo, 'add', '.');
    git(repo, 'commit', '-m', 'init');
    git(repo, 'push', '-u', 'origin', 'main');
    // Unrelated working-tree noise that must never be swept into the seed commit.
    writeFileSync(join(repo, 'unrelated.txt'), 'two\n');
    writeFileSync(join(repo, 'untracked.txt'), 'x\n');

    mkdirSync(join(bundle, 'images'), { recursive: true });
    writeFileSync(join(bundle, 'post.md'), POST);
    writeFileSync(join(bundle, 'images/shot.jpg'), 'jpg');

    writeFileSync(join(fake, 'pnpm'), FAKE_PNPM, { mode: 0o755 });
    writeFileSync(join(fake, 'npx'), '#!/bin/sh\nexit "${FAKE_READABILITY_RC:-0}"\n', { mode: 0o755 });
    writeFileSync(join(fake, 'curl'), FAKE_CURL, { mode: 0o755 });
    symlinkSync(process.execPath, join(fake, 'node'));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  function run(extra: Record<string, string> = {}, args: string[] = ['--bundle', bundle]) {
    return spawnSync(
      'env',
      [
        '-i',
        `HOME=${tmp}`,
        `PATH=${fake}:/usr/bin:/bin`,
        `FAKE_DIR=${fake}`,
        `FAKE_CURL_BODY=${join(tmp, 'live.json')}`,
        `REAL_TSX=${join(ROOT, 'node_modules/.bin/tsx')}`,
        `BLOG_SEED_REPO_ROOT=${repo}`,
        'BLOG_SEED_API_URL=http://fake.invalid/api/blog',
        'BLOG_SEED_VERIFY_TIMEOUT=2',
        'BLOG_SEED_VERIFY_INTERVAL=1',
        'BLOG_SEED_PUSH_BACKOFF=0',
        'GIT_AUTHOR_NAME=T', 'GIT_AUTHOR_EMAIL=t@example.com', 'GIT_COMMITTER_NAME=T', 'GIT_COMMITTER_EMAIL=t@example.com',
        ...Object.entries(extra).map(([k, v]) => `${k}=${v}`),
        'bash',
        SCRIPT,
        ...args,
      ],
      { encoding: 'utf-8', timeout: 120_000 },
    );
  }

  const live = () => writeFileSync(join(tmp, 'live.json'), '[{"slug":"my-post"}]');
  const head = () => git(repo, 'rev-parse', 'HEAD');
  const worktrees = () => git(repo, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree '));
  const committedFiles = (sha: string) => git(origin, 'show', '--name-only', '--format=', sha).split('\n').sort();
  const SEED_FILES = [LEDGER, 'content/blog/my-post.md', 'public/blog-images/my-post/shot.jpg'].sort();
  // A second clone standing in for whoever else pushes to origin/main.
  function otherClone(): string {
    const dir = join(tmp, 'other');
    git(tmp, 'clone', '-q', origin, dir);
    git(dir, 'config', 'user.name', 'T');
    git(dir, 'config', 'user.email', 't@example.com');
    return dir;
  }
  // Commits one file in <dir>: a plan's unshipped work on local main, or another writer's commit.
  function commitFile(dir: string, rel: string, text: string, msg: string): string {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
    git(dir, 'add', '--', rel);
    git(dir, 'commit', '-qm', msg);
    return git(dir, 'rev-parse', 'HEAD');
  }
  // stdout is exactly one line, the result JSON, whatever the mirror logged.
  const resultLine = (stdout: string) => {
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    return JSON.parse(lines[0]);
  };
  const ahead = () => git(repo, 'rev-list', '--count', 'origin/main..main');
  // Local main holds <sha> itself (not a twin: a copy of its patch under another sha, which git
  // cherry marks "-") and is 0 behind origin/main.
  function expectLocalMainHas(sha: string) {
    git(repo, 'fetch', '-q', 'origin');
    expect(spawnSync('git', ['merge-base', '--is-ancestor', sha, 'main'], { cwd: repo }).status).toBe(0);
    expect(git(repo, 'rev-list', '--count', 'main..origin/main')).toBe('0');
    expect(git(repo, 'cherry', 'origin/main', 'main').split('\n').filter((l) => l.startsWith('-'))).toEqual([]);
  }
  const SYNC_WARNING = (rc: number) =>
    new RegExp(`warning: sync-local-main\\.sh --no-push exited ${rc}\\b.*bash scripts/sync-local-main\\.sh`);

  it('publishes: verbatim body, only allowed paths in one commit, pushed, JSON last line', () => {
    live();
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout.trim().split('\n').pop()!);
    expect(out.slug).toBe('my-post');
    expect(out.url).toBe('https://bilko.run/blog/my-post');
    expect(out.commit).toBe(head());
    expect(out.commit).toBe(git(origin, 'rev-parse', 'main'));
    expect(Number.isNaN(new Date(out.published_at).getTime())).toBe(false);

    const files = git(repo, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort();
    expect(files).toEqual([LEDGER, 'content/blog/my-post.md', 'public/blog-images/my-post/shot.jpg'].sort());

    const post = readFileSync(join(repo, 'content/blog/my-post.md'), 'utf-8');
    expect(post).toContain('Human-edited body, kept as is.');
    expect(post).toContain(`published_at: "${out.published_at}"`);
    expect(post).toContain('order: 8');
    expect(readFileSync(join(repo, LEDGER), 'utf-8')).toMatch(/\| my-post \| outdoor-hours \| ✅ \|/);
    expect(readFileSync(join(repo, LEDGER), 'utf-8')).toMatch(/\*\*Last project covered:\*\* outdoor-hours/);
    // unrelated work is still uncommitted, untouched
    expect(git(repo, 'status', '--porcelain')).toBe('M unrelated.txt\n?? untracked.txt');
    expect(readFileSync(join(fake, 'gate-calls'), 'utf-8')).toContain('scripts/blog-cadence-gate.ts check');
    expect(readFileSync(join(fake, 'gate-calls'), 'utf-8')).toContain('root-has-post');
    expect(worktrees()).toHaveLength(1);
  });

  it('local main diverged from origin/main: pushes one seed commit on origin/main, no local-only commit', () => {
    // origin and local main both changed CLAUDE.md since they split, as ea717f21 vs 6523bc88 did.
    const other = otherClone();
    writeFileSync(join(other, 'CLAUDE.md'), 'origin\n');
    git(other, 'commit', '-qam', 'fix(ci): origin shape');
    git(other, 'push', '-q', 'origin', 'main');
    writeFileSync(join(repo, 'CLAUDE.md'), 'local\n');
    git(repo, 'commit', '-qm', 'fix(ci): local shape', '--', 'CLAUDE.md');
    const localOnly = head();
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'merge epic: unpushed');
    const localTip = head();
    const originBefore = git(origin, 'rev-parse', 'main');
    const status = git(repo, 'status', '--porcelain');

    live();
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    const out = resultLine(r.stdout);
    const originAfter = git(origin, 'rev-parse', 'main');
    expect(out.commit).toBe(originAfter);
    expect(git(origin, 'rev-list', '--count', `${originBefore}..${originAfter}`)).toBe('1');
    expect(git(origin, 'rev-parse', `${originAfter}^`)).toBe(originBefore);
    expect(committedFiles(originAfter)).toEqual(SEED_FILES);
    expect(git(origin, 'show', `${originAfter}:CLAUDE.md`)).toBe('origin');
    expect(spawnSync('git', ['cat-file', '-e', localOnly], { cwd: origin }).status).not.toBe(0);

    // The sync cannot replay 'fix(ci): local shape' onto origin's CLAUDE.md and exits 3. That is a
    // warning, not a failure: local main stays as it was, with no cherry-picked twin of the post.
    expect(r.stderr).toMatch(SYNC_WARNING(3));
    expect(head()).toBe(localTip);
    expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf-8')).toBe('local\n');
    expect(existsSync(join(repo, 'content/blog/my-post.md'))).toBe(false);
    expect(git(repo, 'status', '--porcelain')).toBe(status);
    expect(worktrees()).toHaveLength(1);
  });

  it('local main strictly ahead: the seed commit itself goes under the unshipped commit, no twin, 0 behind', () => {
    const unshipped = commitFile(repo, 'server/next.ts', 'next\n', 'feat: not validated yet');
    const base = git(repo, 'rev-parse', 'HEAD^');
    const status = git(repo, 'status', '--porcelain');

    live();
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    const out = resultLine(r.stdout);
    expect(out.commit).toBe(git(origin, 'rev-parse', 'main'));
    expect(git(origin, 'rev-parse', `${out.commit}^`)).toBe(base);
    expect(spawnSync('git', ['cat-file', '-e', unshipped], { cwd: origin }).status).not.toBe(0);

    expectLocalMainHas(out.commit);
    expect(ahead()).toBe('1');
    expect(git(repo, 'rev-parse', 'main^')).toBe(out.commit);
    expect(git(repo, 'log', '-1', '--format=%s', 'main')).toBe('feat: not validated yet');
    expect(readFileSync(join(repo, 'server/next.ts'), 'utf-8')).toBe('next\n');
    expect(readFileSync(join(repo, 'content/blog/my-post.md'), 'utf-8')).toContain('Human-edited body, kept as is.');
    expect(git(repo, 'status', '--porcelain')).toBe(status);
    expect(worktrees()).toHaveLength(1);
  });

  it('local main behind origin/main: fast-forwards to the seed commit itself, no twin', () => {
    // Another publisher pushed after local main last moved.
    const other = otherClone();
    commitFile(other, 'public/projects/app/index.html', 'app\n', 'feat(projects): publish app');
    git(other, 'push', '-q', 'origin', 'main');
    const status = git(repo, 'status', '--porcelain');

    live();
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    const out = resultLine(r.stdout);
    expect(out.commit).toBe(git(origin, 'rev-parse', 'main'));
    expect(head()).toBe(out.commit);
    expectLocalMainHas(out.commit);
    expect(readFileSync(join(repo, 'public/projects/app/index.html'), 'utf-8')).toBe('app\n');
    expect(git(repo, 'status', '--porcelain')).toBe(status);
    expect(worktrees()).toHaveLength(1);
  });

  it('a failed sync only warns; the retry that finds the post on origin/main syncs local main the same way', () => {
    commitFile(repo, 'server/next.ts', 'next\n', 'feat: not validated yet');
    const tip = head();
    // A dirty ledger is in the sync's way (it must update that file), so the first run's sync exits 1.
    const ledger = `${readFileSync(join(repo, LEDGER), 'utf-8')}\nlocal edit\n`;
    writeFileSync(join(repo, LEDGER), ledger);

    const first = run(); // not live yet
    expect(first.status).toBe(5);
    expect(first.stdout).toBe('');
    expect(first.stderr).toMatch(SYNC_WARNING(1));
    expect(head()).toBe(tip);
    expect(readFileSync(join(repo, LEDGER), 'utf-8')).toBe(ledger);
    const pushed = git(origin, 'rev-parse', 'main');
    expect(committedFiles(pushed)).toEqual(SEED_FILES);

    git(repo, 'checkout', '--', LEDGER);
    live();
    const r = run();
    expect(r.status, r.stderr).toBe(0);
    const out = resultLine(r.stdout);
    expect(out.commit).toBe(pushed);
    expect(git(origin, 'rev-parse', 'main')).toBe(pushed); // the retry only polled: no rebuild, no push
    expect(readFileSync(join(fake, 'gate-calls'), 'utf-8').match(/root-has-post/g)).toHaveLength(1);
    expectLocalMainHas(pushed);
    expect(git(repo, 'rev-parse', 'main^')).toBe(pushed);
    expect(git(repo, 'log', '-1', '--format=%s', 'main')).toBe('feat: not validated yet');
    expect(worktrees()).toHaveLength(1);
  }, 30_000); // two seed runs, one of them a full poll window

  it('a push race rebuilds the commit on the new origin/main instead of rebasing local main', () => {
    const other = otherClone();
    live();
    const r = run({ FAKE_RACE_REPO: other });
    expect(r.status, r.stderr).toBe(0);
    const originAfter = git(origin, 'rev-parse', 'main');
    expect(git(origin, 'log', '-1', '--format=%s', `${originAfter}^`)).toBe('race');
    expect(committedFiles(originAfter)).toEqual(SEED_FILES);
    expect(readFileSync(join(fake, 'gate-calls'), 'utf-8').match(/root-has-post/g)).toHaveLength(2);
    expect(worktrees()).toHaveLength(1);
  });

  it('exit 3 when the cadence gate refuses: nothing committed, tree restored', () => {
    const before = { head: head(), status: git(repo, 'status', '--porcelain'), ledger: readFileSync(join(repo, LEDGER), 'utf-8') };
    const r = run({ FAKE_GATE_RC: '1' });
    expect(r.status).toBe(3);
    expect(head()).toBe(before.head);
    expect(git(repo, 'status', '--porcelain')).toBe(before.status);
    expect(readFileSync(join(repo, LEDGER), 'utf-8')).toBe(before.ledger);
    expect(existsSync(join(repo, 'content/blog/my-post.md'))).toBe(false);
    expect(existsSync(join(repo, 'public/blog-images/my-post'))).toBe(false);
    expect(git(origin, 'rev-parse', 'main')).toBe(before.head);
    expect(worktrees()).toHaveLength(1);
  });

  it('exit 2 and no commit for a missing bundle, a missing post.md, or bad frontmatter', () => {
    const h = head();
    expect(run({}, ['--bundle', join(tmp, 'nope')]).status).toBe(2);
    rmSync(join(bundle, 'post.md'));
    expect(run().status).toBe(2);
    writeFileSync(join(bundle, 'post.md'), POST.replace('excerpt: A short note.\n', ''));
    expect(run().status).toBe(2);
    expect(run({}, []).status).toBe(2);
    expect(head()).toBe(h);
    expect(existsSync(join(repo, 'content/blog/my-post.md'))).toBe(false);
  });

  it('refuses when origin is not StanislavBG/bilko-run', () => {
    git(repo, 'remote', 'set-url', 'origin', join(tmp, 'other.git'));
    const h = head();
    expect(run().status).toBe(1);
    expect(head()).toBe(h);
  });

  it('a distinct non-zero exit (5, not 3) when the slug never appears live', () => {
    const r = run(); // no live.json -> fake curl serves []
    expect(r.status).toBe(5);
    expect(git(origin, 'rev-parse', 'main')).toBe(head()); // the push itself landed
  });
});

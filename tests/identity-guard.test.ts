import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identityHits } from './identity-denylist';

// Exercises the identity guard (docs/identity-boundary.md) in throwaway repos with a
// SYNTHETIC deny-list. The real strings must never appear in this repo, tests included.
const GUARD = join(__dirname, '../scripts/identity-guard.sh');
const EMAIL = 'zz-forbidden-owner@example.invalid';
const SURNAME = 'Qqsurnameqq';
const ZERO = '0'.repeat(40);

describe('identity-guard.sh', () => {
  let dir: string;
  let repo: string;
  let denylist: string;

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf-8', env: { ...process.env, ...isolatedGit } }).trim();
  const isolatedGit = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

  function guard(args: string[], opts: { input?: string; env?: Record<string, string> } = {}) {
    const r = spawnSync('bash', [GUARD, ...args], {
      cwd: repo,
      input: opts.input,
      encoding: 'utf-8',
      timeout: 15_000,
      env: { ...process.env, ...isolatedGit, BILKO_IDENTITY_DENYLIST: denylist, ...opts.env },
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  }

  function commitFile(path: string, body: string, message = `add ${path}`) {
    writeFileSync(join(repo, path), body);
    git('add', path);
    git('commit', '-q', '--no-verify', '-m', message);
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'identity-guard-'));
    repo = join(dir, 'repo');
    mkdirSync(repo);
    denylist = join(dir, 'denylist');
    writeFileSync(denylist, `# comment\n${EMAIL}\n\n${SURNAME}\n`);
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Bilko');
    git('config', 'user.email', 'bilko@bilko.run');
    commitFile('README.md', 'hello\n', 'init');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('blocks a staged line with a deny-listed string, case-insensitively, without echoing it', () => {
    writeFileSync(join(repo, 'notes.md'), `Requested by the owner (${EMAIL.toUpperCase()})\n`);
    git('add', 'notes.md');
    const r = guard(['pre-commit']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('notes.md: 1 line(s), deny-list entry #1');
    expect(r.out.toLowerCase()).not.toContain(EMAIL);
  });

  it('allows a commit that only removes a deny-listed line', () => {
    commitFile('old.md', `by ${SURNAME}\n`);
    git('rm', '-q', 'old.md');
    expect(guard(['pre-commit']).status).toBe(0);
  });

  it('blocks a deny-listed author identity', () => {
    const r = guard(['pre-commit'], { env: { GIT_AUTHOR_EMAIL: EMAIL } });
    expect(r.status).toBe(1);
    expect(r.out).toContain('identity');
  });

  it('blocks a deny-listed commit message but ignores git comment lines', () => {
    const msg = join(dir, 'msg');
    writeFileSync(msg, `fix\n# ${EMAIL}\n`);
    expect(guard(['commit-msg', msg]).status).toBe(0);
    writeFileSync(msg, `fix for ${SURNAME}\n`);
    expect(guard(['commit-msg', msg]).status).toBe(1);
  });

  it('blocks a push whose new commits add a deny-listed string, even if a later commit removes it', () => {
    git('init', '-q', '--bare', join(dir, 'remote.git'));
    git('remote', 'add', 'origin', join(dir, 'remote.git'));
    git('push', '-q', '--no-verify', 'origin', 'main');
    const base = git('rev-parse', 'HEAD');
    commitFile('leak.md', `${EMAIL}\n`);
    git('rm', '-q', 'leak.md');
    git('commit', '-q', '--no-verify', '-m', 'remove');
    const r = guard(['pre-push', 'origin'], { input: `refs/heads/main ${git('rev-parse', 'HEAD')} refs/heads/main ${base}\n` });
    expect(r.status).toBe(1);
    expect(r.out).toContain('leak.md: 1 line(s), deny-list entry #1');
  });

  it('lets a clean push through and only warns on a deny-listed identity', () => {
    git('init', '-q', '--bare', join(dir, 'remote.git'));
    git('remote', 'add', 'origin', join(dir, 'remote.git'));
    git('push', '-q', '--no-verify', 'origin', 'main');
    const base = git('rev-parse', 'HEAD');
    execFileSync('git', ['commit', '-q', '--no-verify', '--allow-empty', '-m', 'empty'], {
      cwd: repo,
      env: { ...process.env, ...isolatedGit, GIT_AUTHOR_EMAIL: EMAIL },
    });
    const r = guard(['pre-push', 'origin'], { input: `refs/heads/main ${git('rev-parse', 'HEAD')} refs/heads/main ${base}\n` });
    expect(r.status).toBe(0);
    expect(r.out).toContain('warning: 1 pushed commit(s)');
    // A new branch is scanned against everything not already on the remote.
    const fresh = guard(['pre-push', 'origin'], { input: `refs/heads/x ${git('rev-parse', 'HEAD')} refs/heads/x ${ZERO}\n` });
    expect(fresh.status).toBe(0);
  });

  it('tree mode lists matching tracked files and exits 1, and exits 0 on a clean tree', () => {
    const clean = guard(['tree']);
    expect(clean.status).toBe(0);
    // The count is what lets a CI log prove the scan had real entries to check.
    expect(clean.out).toContain('(2 entries checked)');
    commitFile('a.json', `{"by": "${SURNAME.toLowerCase()}"}\n`);
    const r = guard(['tree']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('a.json: 1 line(s), deny-list entry #2');
    expect(guard(['tree', 'HEAD~1']).status).toBe(0);
  });

  it('tree mode reports a binary file that holds a deny-listed string, without echoing it', () => {
    commitFile('photo.png', `\u0000\u0001exif:${EMAIL}\u0000\n`);
    const r = guard(['tree']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('photo.png: 1 line(s), deny-list entry #1');
    expect(r.out.toLowerCase()).not.toContain(EMAIL);
  });

  it('is a no-op without a deny-list, and treats an empty one as no entries', () => {
    writeFileSync(join(repo, 'n.md'), `${EMAIL}\n`);
    git('add', 'n.md');
    expect(guard(['pre-commit'], { env: { BILKO_IDENTITY_DENYLIST: join(dir, 'missing') } }).status).toBe(0);
    writeFileSync(denylist, '\n# only comments\n');
    expect(guard(['pre-commit']).status).toBe(0);
  });

  describe('word: entries', () => {
    const NAME = 'Qqnameqq';
    const LONGER = `${NAME}xy`;

    const staged = (line: string) => {
      writeFileSync(join(repo, 'notes.md'), `${line}\n`);
      git('add', 'notes.md');
      return guard(['pre-commit']);
    };

    beforeEach(() => writeFileSync(denylist, `word:${NAME}\n`));

    it('blocks the name as a whole word in any case, without echoing it', () => {
      for (const line of [NAME, `by ${NAME.toUpperCase()}.`, `${NAME.toLowerCase()}'s kit`, `(${NAME} Persona)`, `${LONGER} and ${NAME}`]) {
        const r = staged(line);
        expect(r.status, line).toBe(1);
        expect(r.out).toContain('notes.md: 1 line(s), deny-list entry #1');
        expect(r.out.toLowerCase()).not.toContain(NAME.toLowerCase());
      }
    });

    it('allows a longer word that contains the name', () => {
      for (const line of [`github.com/${LONGER}/repo`, `x${NAME}`, `${NAME}_x`, `${NAME}9`]) {
        expect(staged(line).status, line).toBe(0);
      }
    });

    it('applies to commit messages and pushes', () => {
      const msg = join(dir, 'msg');
      writeFileSync(msg, `fix ${LONGER}\n`);
      expect(guard(['commit-msg', msg]).status).toBe(0);
      writeFileSync(msg, `fix for ${NAME}\n`);
      expect(guard(['commit-msg', msg]).status).toBe(1);

      git('init', '-q', '--bare', join(dir, 'remote.git'));
      git('remote', 'add', 'origin', join(dir, 'remote.git'));
      git('push', '-q', '--no-verify', 'origin', 'main');
      const base = git('rev-parse', 'HEAD');
      const push = () => guard(['pre-push', 'origin'], { input: `refs/heads/main ${git('rev-parse', 'HEAD')} refs/heads/main ${base}\n` });
      commitFile('ok.md', `${LONGER}\n`);
      expect(push().status).toBe(0);
      commitFile('leak.md', `${NAME}\n`);
      const r = push();
      expect(r.status).toBe(1);
      expect(r.out).toContain('leak.md: 1 line(s), deny-list entry #1');
    });

    it('tree mode reports the whole word only, in text and binary files, but not in wasm', () => {
      commitFile('longer.md', `${LONGER}\n`);
      commitFile('engine.wasm', `\u0000credits ${NAME} Someone\u0000\n`);
      expect(guard(['tree']).status).toBe(0);
      commitFile('a.md', `by ${NAME}\n`);
      commitFile('photo.png', `\u0000exif:${NAME}\u0000\n`);
      const r = guard(['tree']);
      expect(r.status).toBe(1);
      expect(r.out).toContain('a.md: 1 line(s), deny-list entry #1');
      expect(r.out).toContain('photo.png: 1 line(s), deny-list entry #1');
      expect(r.out).not.toContain('longer.md');
      expect(r.out).not.toContain('engine.wasm');
      expect(guard(['tree', 'HEAD~2']).status).toBe(0);
    });

    it('leaves wasm out for word: entries only', () => {
      writeFileSync(denylist, `${EMAIL}\nword:${NAME}\n`);
      commitFile('engine.wasm', `\u0000${EMAIL} ${NAME}\u0000\n`);
      const r = guard(['tree']);
      expect(r.status).toBe(1);
      expect(r.out).toContain('engine.wasm: 1 line(s), deny-list entry #1');
      expect(r.out).not.toContain('entry #2');
    });

    it('drops an empty word: entry instead of matching everything', () => {
      writeFileSync(denylist, `word:\nWORD:  \n${SURNAME}\n`);
      expect(staged('anything').status).toBe(0);
      expect(staged(SURNAME).status).toBe(1);
    });
  });
});

describe('identityHits', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports entry numbers from the CI secret, and treats a word: entry as a substring', () => {
    vi.stubEnv('IDENTITY_DENYLIST', `# comment\n${EMAIL}\n\nword:${SURNAME}\n`);
    expect(identityHits(`to ${EMAIL.toUpperCase()}`)).toEqual([1]);
    expect(identityHits(`${SURNAME.toLowerCase()}xy`)).toEqual([2]);
    expect(identityHits('clean output')).toEqual([]);
  });

  it('falls back to the local deny-list file, and checks nothing without one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'identity-hits-'));
    const file = join(dir, 'denylist');
    vi.stubEnv('IDENTITY_DENYLIST', '');
    vi.stubEnv('BILKO_IDENTITY_DENYLIST', file);
    expect(identityHits(EMAIL)).toEqual([]);
    writeFileSync(file, `${EMAIL}\r\n`);
    expect(identityHits(EMAIL)).toEqual([1]);
    rmSync(dir, { recursive: true, force: true });
  });
});

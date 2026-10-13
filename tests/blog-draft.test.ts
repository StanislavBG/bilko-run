import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs scripts/blog-draft.sh with fake claude/npx/pnpm stubs on a minimal PATH.
// Never calls the network or the real claude.
const ROOT = join(__dirname, '..');
const SCRIPT = join(ROOT, 'scripts/blog-draft.sh');
const DRAFTS = join(ROOT, '.claude/skills/blog-from-git/drafts');
const SLOT = '2026-10-13T16:00:00Z';

const FAKE_CLAUDE = `#!/bin/bash
echo "$@" > "$FAKE_DIR/claude-args.txt"
case " $* " in *" --model claude-sonnet-5 "*) ;; *) echo "no model pin" >&2; exit 9 ;; esac
case "$FAKE_MODE" in
  drafted|badfm|touch-drafts|touch-content)
    mkdir -p "$FAKE_OUT/images" "$FAKE_OUT/artifacts"
    if [ "$FAKE_MODE" = badfm ]; then
      printf -- '---\\ntitle: No slug here\\n---\\nBody text.\\n' > "$FAKE_OUT/post.md"
    else
      printf -- '---\\nslug: shipped-it\\ntitle: "We shipped it"\\nexcerpt: A "short" note.\\ncategory: Product Update\\n---\\nBody text.\\n\\n![shot](/blog-images/shipped-it/home.jpg "Home")\\n' > "$FAKE_OUT/post.md"
      printf 'jpg' > "$FAKE_OUT/images/home.jpg"
    fi
    [ "$FAKE_MODE" = touch-drafts ] && { mkdir -p "$FAKE_DRAFTS"; echo x > "$FAKE_DRAFTS/rogue.md"; }
    [ "$FAKE_MODE" = touch-content ] && echo x > "$FAKE_ROOT/content/blog/zz-rogue.md"
    echo "DRAFT_RESULT: drafted" ;;
  skipped) echo 'DRAFT_RESULT: skipped reason="all projects on cooldown"' ;;
  nopost) echo "done" ;;
  fail) echo "boom" >&2; exit 3 ;;
esac
exit 0
`;

describe('blog-draft.sh', () => {
  let tmp: string;
  let fake: string;
  let out: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'blog-draft-'));
    fake = join(tmp, 'bin');
    out = join(tmp, 'out');
    mkdirSync(fake);
    writeFileSync(join(fake, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
    // npx stands in for `npx tsx scripts/blog-readability.ts`; pnpm only needs to resolve.
    writeFileSync(join(fake, 'npx'), '#!/bin/sh\nexit "${FAKE_READABILITY_RC:-0}"\n', { mode: 0o755 });
    writeFileSync(join(fake, 'pnpm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(join(ROOT, 'content/blog/zz-rogue.md'), { force: true });
    rmSync(join(DRAFTS, 'rogue.md'), { force: true });
  });

  function run(mode: string, args: string[] = ['--out', out, '--slot', SLOT], extra: Record<string, string> = {}, withFake = true) {
    return spawnSync(
      'env',
      [
        '-i',
        `HOME=${tmp}`,
        `PATH=${withFake ? `${fake}:` : ''}/usr/bin:/bin`,
        `FAKE_MODE=${mode}`,
        `FAKE_DIR=${fake}`,
        `FAKE_OUT=${out}`,
        `FAKE_ROOT=${ROOT}`,
        `FAKE_DRAFTS=${DRAFTS}`,
        ...Object.entries(extra).map(([k, v]) => `${k}=${v}`),
        'bash',
        SCRIPT,
        ...args,
      ],
      { encoding: 'utf8', cwd: tmp },
    );
  }
  const result = () => JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
  const draftsListing = () => (existsSync(DRAFTS) ? readdirSync(DRAFTS).sort() : []);

  it('drafts: exit 0, exact result.json, post.md and images, model pinned', () => {
    const before = draftsListing();
    const r = run('drafted');
    expect(r.status).toBe(0);
    expect(result()).toEqual({
      status: 'drafted',
      slug: 'shipped-it',
      title: 'We shipped it',
      excerpt: 'A "short" note.',
      category: 'Product Update',
    });
    expect(existsSync(join(out, 'post.md'))).toBe(true);
    expect(existsSync(join(out, 'images/home.jpg'))).toBe(true);
    expect(readFileSync(join(fake, 'claude-args.txt'), 'utf8')).toContain('--model claude-sonnet-5');
    expect(draftsListing()).toEqual(before);
  });

  it('skipped: exit 0, reason recorded, no post.md', () => {
    const r = run('skipped');
    expect(r.status).toBe(0);
    expect(result()).toEqual({ status: 'skipped', reason: 'all projects on cooldown' });
    expect(existsSync(join(out, 'post.md'))).toBe(false);
  });

  it.each([
    ['claude non-zero', 'fail', {}],
    ['missing post.md', 'nopost', {}],
    ['malformed frontmatter', 'badfm', {}],
    ['readability failure', 'drafted', { FAKE_READABILITY_RC: '1' }],
  ])('error: %s -> non-zero exit and error result.json', (_n, mode, extra) => {
    const r = run(mode, undefined, extra);
    expect(r.status).toBe(1);
    expect(result().status).toBe('error');
    expect(result().error).toBeTruthy();
  });

  it('error: names the missing binary', () => {
    const r = run('drafted', undefined, {}, false);
    expect(r.status).toBe(1);
    expect(result().error).toContain('claude');
  });

  it('fails and leaves drafts/ listing unchanged when claude writes into drafts/ is detected', () => {
    const r = run('touch-drafts');
    expect(r.status).toBe(1);
    expect(result().status).toBe('error');
    expect(result().error).toContain('guarded paths');
  });

  it('fails when claude writes into content/blog/', () => {
    const r = run('touch-content');
    expect(r.status).toBe(1);
    expect(result().error).toContain('guarded paths');
  });

  it.each([
    ['missing --out', ['--slot', SLOT]],
    ['relative --out', ['--out', 'rel/dir', '--slot', SLOT]],
    ['unparseable --slot', ['--out', '/tmp/x-blog-draft', '--slot', 'tomorrow']],
    ['missing --slot', ['--out', '/tmp/x-blog-draft']],
    ['unknown flag', ['--bogus']],
  ])('bad args: %s exits 2 with usage', (_n, args) => {
    const r = run('drafted', args);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('usage: bash scripts/blog-draft.sh');
  });
});

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
// Burrow's draft context: the public set and the posts already covered.
const CONTEXT = {
  schema_version: 1,
  slot_at: SLOT,
  public_projects: [{ slug: 'public-one', name: 'Public One' }, { slug: 'public-two', name: 'Public Two' }],
  blog_posts: [],
};
const BRIEF = {
  project: 'public-one',
  angle: 'The v2 release.',
  sources: [{ repo: 'owner/public-one', from_ref: 'v1', to_ref: 'v2' }],
  facts: ['v2 shipped on Nov 13.'],
  avoid_claims: ['It is a hosted service.'],
};

const FAKE_CLAUDE = `#!/bin/bash
echo "$@" > "$FAKE_DIR/claude-args.txt"
case " $* " in *" --model claude-sonnet-5 "*) ;; *) echo "no model pin" >&2; exit 9 ;; esac
case "$FAKE_MODE" in
  drafted|nonpublic|badfm|touch-drafts|touch-content)
    mkdir -p "$FAKE_OUT/images" "$FAKE_OUT/artifacts"
    if [ "$FAKE_MODE" = badfm ]; then
      printf -- '---\\ntitle: No slug here\\n---\\nBody text.\\n' > "$FAKE_OUT/post.md"
    else
      PROJECT=public-one; [ "$FAKE_MODE" = nonpublic ] && PROJECT=admin-only
      printf -- '---\\nslug: shipped-it\\ntitle: "We shipped it"\\nexcerpt: A "short" note.\\ncategory: Product Update\\nproject: %s\\n---\\nBody text.\\n\\n![shot](/blog-images/shipped-it/home.jpg "Home")\\n' "$PROJECT" > "$FAKE_OUT/post.md"
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
    // npx stands in for `npx tsx scripts/blog-readability.ts`; blog-subjects.ts runs for real.
    // pnpm only needs to resolve.
    writeFileSync(
      join(fake, 'npx'),
      '#!/bin/sh\ncase "$2" in *blog-subjects.ts) shift; exec "$REAL_TSX" "$@" ;; esac\nexit "${FAKE_READABILITY_RC:-0}"\n',
      { mode: 0o755 },
    );
    writeFileSync(join(tmp, 'context.json'), JSON.stringify(CONTEXT));
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
        `REAL_TSX=${join(ROOT, 'node_modules/.bin/tsx')}`,
        `BLOG_DRAFT_CONTEXT=${join(tmp, 'context.json')}`,
        ...Object.entries(extra).map(([k, v]) => `${k}=${v}`),
        'bash',
        SCRIPT,
        ...args,
      ],
      { encoding: 'utf8', cwd: tmp },
    );
  }
  const result = () => JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
  const claudeArgs = () => readFileSync(join(fake, 'claude-args.txt'), 'utf8');
  const withBrief = (brief: unknown) =>
    writeFileSync(join(tmp, 'context.json'), JSON.stringify({ ...CONTEXT, brief }));
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
      project: 'public-one',
    });
    expect(existsSync(join(out, 'post.md'))).toBe(true);
    expect(existsSync(join(out, 'images/home.jpg'))).toBe(true);
    expect(claudeArgs()).toContain('--model claude-sonnet-5');
    expect(claudeArgs()).not.toContain('OWNER-COMMISSIONED');
    expect(claudeArgs()).not.toContain('brief_project');
    expect(draftsListing()).toEqual(before);
  });

  it('a brief: the prompt commissions a focused post on brief.project from brief.sources', () => {
    withBrief(BRIEF);
    const r = run('drafted');
    expect(r.status).toBe(0);
    expect(result()).toMatchObject({ status: 'drafted', project: 'public-one' });
    const prompt = claudeArgs();
    expect(prompt).toContain('owner-commissioned post about public-one');
    expect(prompt).toContain('Mode: Focused');
    expect(prompt).toContain('project: public-one');
    expect(prompt).toContain('take it from brief.sources');
    expect(prompt).toContain('brief.facts are leads');
    expect(prompt).toContain('Never make a claim listed in brief.avoid_claims');
    expect(prompt).toContain('"candidates":[{"slug":"public-one"');
    expect(prompt).not.toContain('"slug":"public-two","name":"Public Two","last_covered"');
    expect(prompt).toContain('"brief_project":"public-one"');
  });

  it("a brief: refuses a post about another project, naming both", () => {
    withBrief({ ...BRIEF, project: 'public-two' });
    const r = run('drafted');
    expect(r.status).toBe(1);
    expect(result().status).toBe('error');
    expect(result().error).toContain("subject refused: commissioned post is about public-one, not the brief's project public-two");
  });

  it('a brief whose project is not in public_projects: blog-subjects exits 2 and claude never runs', () => {
    withBrief({ ...BRIEF, project: 'admin-only' });
    const r = run('drafted');
    expect(r.status).toBe(1);
    expect(result().error).toContain('could not compute blog subjects (exit 2)');
    expect(result().error).toContain('brief project is not in public_projects: admin-only');
    expect(existsSync(join(fake, 'claude-args.txt'))).toBe(false);
  });

  it('a brief on a cooling-off project: skipped with a reason naming it', () => {
    writeFileSync(join(tmp, 'context.json'), JSON.stringify({
      ...CONTEXT,
      blog_posts: [{ slot_at: '2026-10-10T16:00:00Z', slug: 'last-one', project: 'public-one' }],
      brief: BRIEF,
    }));
    const r = run('drafted');
    expect(r.status).toBe(0);
    expect(result()).toEqual({ status: 'skipped', reason: 'the commissioned project public-one is cooling off or retired' });
    expect(existsSync(join(fake, 'claude-args.txt'))).toBe(false);
  });

  it('bp_draft_prompt: a brief adds exactly one paragraph; without one the prompt is unchanged', () => {
    const file = join(tmp, 'prompt-context.json');
    const prompt = () => {
      const r = spawnSync('bash', ['-c', 'source "$1" && bp_draft_prompt /tmp/out "$2" 2026-10-13T15:00:00Z "{}" "$3"', '_',
        join(ROOT, 'scripts/blog-pipeline-lib.sh'), SLOT, file], { encoding: 'utf8' });
      expect(r.status).toBe(0);
      return r.stdout;
    };
    writeFileSync(file, JSON.stringify(CONTEXT));
    const plain = prompt();
    writeFileSync(file, JSON.stringify({ ...CONTEXT, brief: BRIEF }));
    const briefed = prompt();
    const start = briefed.indexOf('\n\nOWNER-COMMISSIONED POST:');
    const end = briefed.indexOf('\n\nContent DAG:');
    expect(plain).not.toContain('OWNER-COMMISSIONED');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(briefed.slice(0, start) + briefed.slice(end)).toBe(plain);
  });

  it('refuses a post whose project is not public: non-zero exit, error result.json', () => {
    const r = run('nonpublic');
    expect(r.status).toBe(1);
    expect(result().status).toBe('error');
    expect(result().error).toContain('subject refused');
    expect(result().error).toContain('admin-only');
    expect(result().slug).toBeUndefined();
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

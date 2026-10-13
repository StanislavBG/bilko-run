import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

// scripts/blog-cadence-watchdog.sh decides WHEN to draft/seed and maps exit codes to the
// heartbeat; the drafting and seeding themselves live in scripts/blog-draft.sh and
// scripts/blog-seed.sh (one implementation until Burrow's cutover). The first describe block is
// static structure, the second runs the real watchdog in a scratch repo against fake entrypoints.
const ROOT = join(__dirname, '..');
let script: string;

beforeAll(() => {
  script = readFileSync(join(ROOT, 'scripts/blog-cadence-watchdog.sh'), 'utf-8');
});

describe('blog-cadence-watchdog.sh structure', () => {
  it('drafts into a temp dir with --slot NEXT_SLOT, then seeds that bundle via blog-seed.sh', () => {
    expect(script).toMatch(/DRAFT_CMD=\(bash scripts\/blog-draft\.sh\)/);
    expect(script).toMatch(/SEED_CMD=\(bash scripts\/blog-seed\.sh\)/);
    expect(script).toMatch(/"\$\{DRAFT_CMD\[@\]\}" --out "\$BUNDLE_DIR" --slot "\$NEXT_SLOT"/);
    expect(script).toMatch(/"\$\{SEED_CMD\[@\]\}" --bundle "\$bundle"/);
    expect(script).toMatch(/WORK_DIR="\$\(mktemp -d\)"/);
    expect(script.indexOf('--out "$BUNDLE_DIR"')).toBeLessThan(script.indexOf('run_seed "$BUNDLE_DIR"'));
  });

  it('has no inline seed/push/verify code or inline publishing prompt left', () => {
    // the scan-only prompt legitimately says "Do NOT run git add…", so match command usage
    expect(script).not.toMatch(/^\s*(?:\w+="?\$\()?git (push|commit|add|rebase)\b/m);
    for (const gone of [
      'SEED_RESULT',
      'REQUIREMENTS=',
      'claude -p "$PROMPT"',
      'ALLOWED_COMMIT_PATHS',
    ]) {
      expect(script, gone).not.toContain(gone);
    }
  });

  it('pins an explicit --model on every claude -p call', () => {
    const claudeCalls = script.match(/claude -p[\s\S]*?--output-format text/g) ?? [];
    expect(claudeCalls.length).toBeGreaterThan(0);
    for (const call of claudeCalls) {
      expect(call).toMatch(/--model\s+\S+/);
    }
  });

  it('only lets BLOG_DRAFT_CMD / BLOG_SEED_CMD replace the entrypoints', () => {
    expect(script).toMatch(/BLOG_DRAFT_CMD/);
    expect(script).toMatch(/BLOG_SEED_CMD/);
  });

  it('skips pending drafts (exit 0, no entrypoint call) only in non-autonomous mode, with the age-based warn', () => {
    const guardMatch = script.match(/EXISTING_DRAFTS\[@\]\} > 0 \)\) && \[\[ "\$AUTONOMOUS_PUBLISH" != "true" \]\][\s\S]*?exit 0\s*\nfi/);
    expect(guardMatch).not.toBeNull();
    expect(guardMatch![0]).not.toMatch(/DRAFT_CMD|SEED_CMD|claude -p/);
    expect(guardMatch![0]).toMatch(/pending_draft_alert_days/);
    expect(script).toMatch(/CONSUME_EXISTING_DRAFTS=1/);
  });

  it('writes .watchdog-state before invoking blog-draft.sh', () => {
    expect(script.indexOf('> "$STATE_FILE"')).toBeGreaterThan(-1);
    expect(script.indexOf('echo "$TODAY $MODE $GAP_DAYS" > "$STATE_FILE"')).toBeLessThan(script.indexOf('--out "$BUNDLE_DIR"'));
  });

  it('parses the autonomy kill switch and max_posts_per_run with a FATAL heartbeat on failure', () => {
    expect(script).toMatch(/AUTONOMOUS_PUBLISH="\$\(grep -m1 'autonomous_publish:' "\$CONFIG_FILE" \| grep -oP/);
    expect(script).toMatch(/MAX_POSTS_PER_RUN="\$\(grep -m1 'max_posts_per_run:' "\$CONFIG_FILE" \| grep -oP/);
    expect(script).toMatch(/write_heartbeat "error: could not parse autonomy settings"/);
  });

  it('asserts the push remote resolves to StanislavBG/bilko-run before any autonomous run', () => {
    expect(script).toMatch(/git remote get-url "\$PUSH_REMOTE_NAME"/);
    expect(script).toMatch(/write_heartbeat "error: push remote does not resolve to StanislavBG\/bilko-run"/);
  });

  it('retries the /api/blog fetch with a backoff, validates the array shape before .published_at, and FATALs when exhausted', () => {
    expect((script.match(/curl -s --max-time 20 https:\/\/bilko\.run\/api\/blog/g) ?? []).length).toBe(1);
    expect(script).toMatch(/fetch_blog_json 3 10/);
    expect(script).toMatch(/sleep "\$backoff_seconds"/);
    expect(script.indexOf("jq -e 'type == \"array\" and length > 0'")).toBeLessThan(script.indexOf('NEWEST_PUBLISHED_AT="$(echo'));
    expect(script).toMatch(/write_heartbeat "error: could not read published_at from \/api\/blog"/);
  });

  it('installs an EXIT trap that guarantees a heartbeat and removes the temp dir', () => {
    expect(script).toMatch(/trap on_exit EXIT/);
    const onExitFn = script.match(/on_exit\(\) \{[\s\S]*?\n\}/);
    expect(onExitFn).not.toBeNull();
    expect(onExitFn![0]).toMatch(/HEARTBEAT_WRITTEN"\s*-eq\s*0/);
    expect(onExitFn![0]).toMatch(/rm -rf "\$WORK_DIR"/);
    expect(script.match(/write_heartbeat\(\) \{[\s\S]*?\n\}/)![0]).toMatch(/HEARTBEAT_WRITTEN=1/);
  });

  it('computes NEXT_SLOT from the cadence gate (fail closed) and scans only while it is in the future', () => {
    const invocation = script.indexOf('pnpm tsx scripts/blog-cadence-gate.ts next-slot');
    expect(invocation).toBeGreaterThan(script.indexOf('GAP_DAYS=$(( (NOW_EPOCH - PUB_EPOCH)'));
    expect(invocation).toBeLessThan(script.indexOf('--out "$BUNDLE_DIR"'));
    expect(script).toMatch(/write_heartbeat "error: cadence gate unavailable"/);
    const compare = script.indexOf('NEXT_SLOT_EPOCH="$(date -d "$NEXT_SLOT" +%s)"');
    expect(compare).toBeGreaterThan(script.indexOf('PUBLISH_DUE="$(publish_due_status'));
    expect(compare).toBeLessThan(script.indexOf('idempotent per day'));
    expect(script.slice(compare, compare + 400)).toMatch(/NOW_EPOCH < NEXT_SLOT_EPOCH[\s\S]*run_scan_only/);
  });

  it('scans daily (run_scan_only) before and independent of the publish-due decision, including on the same-day lock', () => {
    expect(script).toMatch(/run_scan_only\(\) \{/);
    const lockBlock = script.slice(script.indexOf('LAST_RUN_DATE="$(cut'), script.indexOf('LAST_RUN_DATE="$(cut') + 400);
    expect(lockBlock).toMatch(/run_scan_only/);
  });

  it('keeps scan_every_days and the lower-bound target_gap_days parse', () => {
    expect(script).toMatch(/scan_every_days is not 1/);
    expect(script).toMatch(/LOWER_BOUND="\$\(grep -m1 'target_gap_days:' "\$CONFIG_FILE" \| grep -oP '\\\[\\K\\d\+'\)"/);
    const config = readFileSync(join(ROOT, '.claude/skills/blog-from-git/blog.config.yaml'), 'utf-8');
    expect(config.match(/target_gap_days:.*/)![0]).toMatch(/\[3,\s*4\]/);
  });

  it('seed exit 3 never errors; every other failure names the script and rc', () => {
    expect(script).toMatch(/cadence hold \(blog-seed\.sh rc=3\)/);
    expect(script).toMatch(/error: blog-seed\.sh rc=\$rc/);
    expect(script).toMatch(/error: blog-draft\.sh rc=\$DRAFT_RC/);
  });

  it('keeps drafts/<slug>/ artifact dirs out of the pending-drafts glob', () => {
    expect(script).toMatch(/\[\[ -f "\$_d" \]\] && _FILTERED_DRAFTS\+=/);
  });

  describe('allowed_commit_paths parser (now owned by blog-seed.sh)', () => {
    function awkProgram(): string {
      const match = readFileSync(join(ROOT, 'scripts/blog-seed.sh'), 'utf-8').match(/ALLOWED_PATHS_AWK='([\s\S]*?)'\n/);
      expect(match).not.toBeNull();
      return match![1];
    }
    it('returns the configured paths from the real blog.config.yaml', () => {
      const out = execFileSync('awk', [awkProgram(), join(ROOT, '.claude/skills/blog-from-git/blog.config.yaml')], { encoding: 'utf-8' });
      const paths = out.split('\n').map((l) => l.replace(/^\s*-\s*/, '').replace(/\s*#.*$/, '').trim()).filter(Boolean);
      expect(paths).toEqual(['content/blog/', 'public/blog-images/', '.claude/skills/blog-from-git/blog-ledger.md']);
    });
  });
});

function extractFn(name: string): string {
  const match = script.match(new RegExp(`${name}\\(\\) \\{[\\s\\S]*?\\n\\}`));
  expect(match, name).not.toBeNull();
  return match![0];
}
function runFn(name: string, args: Array<string | number>): string {
  return execFileSync('bash', ['-c', `${extractFn(name)}\n${name} "$@"`, name, ...args.map(String)], { encoding: 'utf-8' }).trim();
}

describe('pure decisions', () => {
  it('heartbeat status: over-cadence + nothing seeded => warn; quiet day => ok; seeded => ok', () => {
    expect(runFn('heartbeat_status_for_outcome', [12, 5, 0])).toBe('warn');
    expect(runFn('heartbeat_status_for_outcome', [2, 5, 0])).toBe('ok');
    expect(runFn('heartbeat_status_for_outcome', [12, 5, 1])).toBe('ok');
  });
  it('publish due uses the lower bound', () => {
    expect(runFn('publish_due_status', [3, 3])).toBe('due');
    expect(runFn('publish_due_status', [2, 3])).toBe('not_due');
    expect(runFn('publish_due_status', [4, 3])).toBe('due');
  });
  it('the same-day lock is kept only when blog-seed.sh returned 0', () => {
    expect(runFn('keep_state_lock_for_seed_rc', [0])).toBe('keep');
    for (const rc of [1, 2, 3, 4, 5, 124]) expect(runFn('keep_state_lock_for_seed_rc', [rc])).toBe('clear');
    expect(runFn('keep_state_lock_for_seed_rc', [''])).toBe('clear');
  });
});

// --- execution: the real watchdog in a scratch repo, with fake draft/seed entrypoints ---
const FAKE_DRAFT = `#!/bin/bash
echo "$@" >> "$FAKE_LOG/draft-calls.txt"
OUT=""; while [ $# -gt 0 ]; do [ "$1" = "--out" ] && OUT="$2"; shift; done
mkdir -p "$OUT"
case "$FAKE_DRAFT" in
  drafted)
    printf -- '---\\nslug: shipped-it\\ntitle: "We shipped it"\\nexcerpt: A short note.\\ncategory: Product Update\\n---\\nBody text.\\n' > "$OUT/post.md"
    echo '{"status":"drafted","slug":"shipped-it"}' > "$OUT/result.json" ;;
  skipped) echo '{"status":"skipped","reason":"all projects on cooldown"}' > "$OUT/result.json" ;;
  error) echo '{"status":"error","error":"claude timed out"}' > "$OUT/result.json"; exit 1 ;;
esac
exit 0
`;
const FAKE_SEED = `#!/bin/bash
echo "$@" >> "$FAKE_LOG/seed-calls.txt"
B=""; while [ $# -gt 0 ]; do [ "$1" = "--bundle" ] && B="$2"; shift; done
cat "$B/post.md" >> "$FAKE_LOG/seed-posts.txt"
[ "$FAKE_SEED_RC" = "0" ] && echo '{"slug":"shipped-it","url":"https://bilko.run/blog/shipped-it","commit":"abc","published_at":"2026-10-13T16:00:00Z"}'
exit "$FAKE_SEED_RC"
`;

describe('blog-cadence-watchdog.sh execution (fake blog-draft.sh / blog-seed.sh)', () => {
  let repo: string;
  let log: string;
  let bin: string;

  beforeEach(() => {
    const tmp = mkdtempSync(join(tmpdir(), 'watchdog-'));
    repo = join(tmp, 'repo');
    log = join(tmp, 'log');
    bin = join(tmp, 'bin');
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    mkdirSync(join(repo, '.claude/skills/blog-from-git'), { recursive: true });
    mkdirSync(log);
    mkdirSync(bin);
    for (const f of ['blog-cadence-watchdog.sh', 'blog-watchdog-env.sh', 'blog-pipeline-lib.sh']) {
      cpSync(join(ROOT, 'scripts', f), join(repo, 'scripts', f));
    }
    cpSync(join(ROOT, '.claude/skills/blog-from-git/blog.config.yaml'), join(repo, '.claude/skills/blog-from-git/blog.config.yaml'));
    writeFileSync(join(tmp, 'fake-draft.sh'), FAKE_DRAFT);
    writeFileSync(join(tmp, 'fake-seed.sh'), FAKE_SEED);
    const old = new Date(Date.now() - 10 * 86400_000).toISOString();
    const fakes: Record<string, string> = {
      curl: `#!/bin/sh\necho '[{"slug":"old","published_at":"${old}"}]'\n`,
      pnpm: `#!/bin/sh\necho 2020-01-01T00:00:00Z\n`,
      npx: `#!/bin/sh\nexit 0\n`,
      claude: `#!/bin/sh\necho "SCAN_RESULT: nothing"\n`,
    };
    for (const [name, body] of Object.entries(fakes)) {
      writeFileSync(join(bin, name), body);
      chmodSync(join(bin, name), 0o755);
    }
    execFileSync('git', ['init', '-q'], { cwd: repo });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/StanislavBG/bilko-run.git'], { cwd: repo });
  });
  afterEach(() => rmSync(join(repo, '..'), { recursive: true, force: true }));

  function setAutonomous(value: 'true' | 'false') {
    const cfg = join(repo, '.claude/skills/blog-from-git/blog.config.yaml');
    writeFileSync(cfg, readFileSync(cfg, 'utf-8').replace(/autonomous_publish:\s*(true|false)/, `autonomous_publish: ${value}`));
  }
  function run(env: Record<string, string>) {
    return spawnSync('bash', [join(repo, 'scripts/blog-cadence-watchdog.sh')], {
      encoding: 'utf-8',
      timeout: 60_000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        HOME: join(repo, '..'), // env.sh prepends $HOME/.npm-global/bin; keep the fakes first
        FAKE_LOG: log,
        BLOG_DRAFT_CMD: `bash ${join(repo, '../fake-draft.sh')}`,
        BLOG_SEED_CMD: `bash ${join(repo, '../fake-seed.sh')}`,
        ...env,
      },
    });
  }
  const drafts = () => join(repo, '.claude/skills/blog-from-git/drafts');
  const heartbeat = () => readFileSync(join(drafts(), '.watchdog-heartbeat'), 'utf-8');
  const state = () => join(drafts(), '.watchdog-state');
  const calls = (name: string) => (existsSync(join(log, name)) ? readFileSync(join(log, name), 'utf-8') : '');

  it('drafted + seeded: calls draft with --out/--slot, then seed on that bundle, keeps the lock, ok heartbeat', () => {
    setAutonomous('true');
    const r = run({ FAKE_DRAFT: 'drafted', FAKE_SEED_RC: '0' });
    expect(r.status, r.stderr + r.stdout).toBe(0);
    const draftCall = calls('draft-calls.txt');
    expect(draftCall).toMatch(/--out \S+\/bundle --slot 2020-01-01T00:00:00Z/);
    const bundle = draftCall.match(/--out (\S+)/)![1];
    expect(calls('seed-calls.txt')).toContain(`--bundle ${bundle}`);
    expect(heartbeat()).toMatch(/ ok: published slugs=shipped-it url=https:\/\/bilko\.run\/blog\/shipped-it/);
    expect(existsSync(state())).toBe(true);
    expect(existsSync(bundle)).toBe(false); // temp dir cleaned up
  });

  it('draft skipped: no seed, lock cleared, ok/warn heartbeat naming the reason, exit 0', () => {
    setAutonomous('true');
    const r = run({ FAKE_DRAFT: 'skipped', FAKE_SEED_RC: '0' });
    expect(r.status, r.stderr).toBe(0);
    expect(calls('seed-calls.txt')).toBe('');
    expect(heartbeat()).toMatch(/ (ok|warn): draft skipped \(all projects on cooldown\)/);
    expect(existsSync(state())).toBe(false);
  });

  it('seed exit 3: no commit, lock cleared, heartbeat reflects the cadence hold, exit 0', () => {
    setAutonomous('true');
    const r = run({ FAKE_DRAFT: 'drafted', FAKE_SEED_RC: '3' });
    expect(r.status, r.stderr).toBe(0);
    expect(heartbeat()).toMatch(/ (ok|warn): cadence hold \(blog-seed\.sh rc=3\)/);
    expect(existsSync(state())).toBe(false);
  });

  it('other seed failure: error heartbeat naming blog-seed.sh and rc, exit 1, lock cleared', () => {
    setAutonomous('true');
    const r = run({ FAKE_DRAFT: 'drafted', FAKE_SEED_RC: '5' });
    expect(r.status).toBe(1);
    expect(heartbeat()).toMatch(/ error: blog-seed\.sh rc=5/);
    expect(existsSync(state())).toBe(false);
  });

  it('draft failure: error heartbeat naming blog-draft.sh and rc, no seed', () => {
    setAutonomous('true');
    const r = run({ FAKE_DRAFT: 'error', FAKE_SEED_RC: '0' });
    expect(r.status).toBe(1);
    expect(heartbeat()).toMatch(/ error: blog-draft\.sh rc=1 \(claude timed out\)/);
    expect(calls('seed-calls.txt')).toBe('');
    expect(existsSync(state())).toBe(false);
  });

  it('non-autonomous: leaves a reviewable draft with the front-matter fields and never seeds', () => {
    setAutonomous('false');
    const r = run({ FAKE_DRAFT: 'drafted', FAKE_SEED_RC: '0' });
    expect(r.status, r.stderr).toBe(0);
    expect(calls('seed-calls.txt')).toBe('');
    const files = readdirSync(drafts()).filter((f) => f.endsWith('-shipped-it.md'));
    expect(files).toHaveLength(1);
    const draft = readFileSync(join(drafts(), files[0]), 'utf-8');
    for (const key of ['title:', 'slug:', 'category:', 'published_at:', 'tone:', 'authored_by: blog-cadence-watchdog', 'authored_at:']) {
      expect(draft).toContain(key);
    }
    expect(draft).toContain('Body text.');
    expect(heartbeat()).toMatch(/ ok: drafted/);
  });

  it('autonomous with a pending draft: seeds it as a bundle (excerpt derived), removes the file, does not draft', () => {
    setAutonomous('true');
    mkdirSync(drafts(), { recursive: true });
    writeFileSync(
      join(drafts(), '2026-10-01-old-one.md'),
      '---\ntitle: Old one\nslug: old-one\ncategory: Product Update\npublished_at: 2026-10-01\ntone: plain\nauthored_by: blog-cadence-watchdog\n---\n\n# Heading\n\nFirst real [paragraph](https://x.test) here.\n'
    );
    const r = run({ FAKE_DRAFT: 'drafted', FAKE_SEED_RC: '0' });
    expect(r.status, r.stderr + r.stdout).toBe(0);
    expect(calls('draft-calls.txt')).toBe('');
    const seeded = calls('seed-posts.txt');
    expect(seeded).toContain('slug: "old-one"');
    expect(seeded).toContain('excerpt: "First real paragraph here."');
    expect(seeded).not.toContain('published_at');
    expect(existsSync(join(drafts(), '2026-10-01-old-one.md'))).toBe(false);
    expect(heartbeat()).toMatch(/ ok: published slugs=old-one/);
  });

  it('autonomous pending drafts honour max_posts_per_run and leave the rest untouched', () => {
    setAutonomous('true');
    mkdirSync(drafts(), { recursive: true });
    for (const n of ['a', 'b']) {
      writeFileSync(join(drafts(), `2026-10-01-${n}.md`), `---\ntitle: T ${n}\nslug: post-${n}\ncategory: Product Update\n---\n\nBody ${n}.\n`);
    }
    const r = run({ FAKE_DRAFT: 'drafted', FAKE_SEED_RC: '0' });
    expect(r.status, r.stderr).toBe(0);
    expect(calls('seed-calls.txt').trim().split('\n')).toHaveLength(1); // max_posts_per_run: 1
    expect(readdirSync(drafts()).filter((f) => f.endsWith('.md'))).toEqual(['2026-10-01-b.md']);
  });

  it('non-autonomous pending drafts still skip without calling either entrypoint', () => {
    setAutonomous('false');
    mkdirSync(drafts(), { recursive: true });
    writeFileSync(join(drafts(), '2026-10-01-a.md'), '---\ntitle: T\nslug: a\ncategory: c\n---\n\nBody.\n');
    const r = run({ FAKE_DRAFT: 'drafted', FAKE_SEED_RC: '0' });
    expect(r.status, r.stderr).toBe(0);
    expect(calls('draft-calls.txt')).toBe('');
    expect(calls('seed-calls.txt')).toBe('');
    expect(heartbeat()).toMatch(/ (ok|warn): 1 unreviewed draft/);
  });
});

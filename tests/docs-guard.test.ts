import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(__dirname, '../scripts/docs-guard.sh');
let dir: string;

function write(name: string, body: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body);
  return file;
}

function run(...files: string[]) {
  const r = spawnSync('bash', [scriptPath, ...files], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-guard-'));
  fs.writeFileSync(path.join(dir, 'sibling.md'), '# Sibling\n');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('docs-guard.sh', () => {
  it('passes a clean fixture and reports the file count', () => {
    const f = write('clean.md', '# Title\n\nCurrent facts only. See [web](https://example.com) and [top](#title).\n');
    const r = run(f);
    expect(r.stdout).toContain('docs-guard: clean (1 files)');
    expect(r.status).toBe(0);
  });

  const cases: Array<[string, string]> = [
    ['date', 'Shipped on 2026-11-22 to prod.'],
    ['prd', 'Landed in PRD 1894 last week.'],
    ['prd', 'See PRDs 1894-1911.'],
    ['sha', 'Fixed by `6827c539` on main.'],
    ['history', 'This No Longer applies.'],
    ['history', 'It used to be different.'],
    ['history', 'Previously it ran on Replit.'],
    ['history', 'As of today it is live.'],
    ['history', 'Per the owner decision we stopped.'],
    ['history', 'Until recently it was off.'],
  ];
  for (const [rule, text] of cases) {
    it(`flags ${rule}: ${text}`, () => {
      const f = write(`hit-${rule}.md`, `# Doc\n\n${text}\n`);
      const r = run(f);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain(`${f}:3: ${rule}: ${text}`);
    });
  }

  it('does not flag phrases inside longer words or uppercase hex', () => {
    const f = write('near.md', '# Doc\n\nWe reused tools; caused nothing. Code `ABCDEF12` and `abc12`. PRD-style text.\n');
    const r = run(f);
    expect(r.stdout).toBe('docs-guard: clean (1 files)\n');
    expect(r.status).toBe(0);
  });

  it('skips fenced code blocks, HTML comments and allow lines', () => {
    const body = [
      '# Doc',
      '```bash',
      'echo 2026-11-22 previously',
      '```',
      '~~~',
      'PRD 1894',
      '~~~',
      '<!-- as of 2026-01-01 -->',
      '<!--',
      'used to be `deadbeef1`',
      '[x](missing.md)',
      '-->',
      'Dated 2026-11-22 here. <!-- docs-guard: allow -->',
      'Clean line.',
    ].join('\n');
    const f = write('skips.md', body + '\n');
    const r = run(f);
    expect(r.stdout).toBe('docs-guard: clean (1 files)\n');
    expect(r.status).toBe(0);
  });

  it('flags a broken relative link and passes an existing one', () => {
    const ok = write('link-ok.md', '# Doc\n\nSee [s](sibling.md#sibling) and [mail](mailto:a@b.c) and [abs](/x).\n');
    const okRun = run(ok);
    expect(okRun.status).toBe(0);

    const bad = write('link-bad.md', '# Doc\n\nSee [gone](nope/missing.md#x).\n');
    const badRun = run(bad);
    expect(badRun.status).toBe(1);
    expect(badRun.stdout).toContain(`${bad}:3: link: nope/missing.md`);
  });

  it('checks only the given files and reports every hit', () => {
    const a = write('multi-a.md', '2026-01-01\nPRD 123\n');
    const b = write('multi-b.md', 'fine\n');
    const r = run(a, b);
    expect(r.status).toBe(1);
    expect(r.stdout.trim().split('\n')).toEqual([
      `${a}:1: date: 2026-01-01`,
      `${a}:2: prd: PRD 123`,
    ]);
  });

  it('exits 2 with usage on a missing file', () => {
    const r = run(path.join(dir, 'does-not-exist.md'));
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage: /);
  });
});

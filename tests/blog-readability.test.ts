import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeReadability, DEFAULT_THRESHOLDS } from '../scripts/blog-readability';

const BROKEN_LINK_PARAGRAPH = [
  'Check out [the project page](/projects/git-viewer/) for the full tour.',
  'Best of all, the project is open source, so you can poke around the code.',
].join(' ');

const FIXED_LINK_PARAGRAPH = [
  'Check out [the project page](https://bilko.run/projects/git-viewer/) for the full tour.',
  'Best of all, the project is open source at https://github.com/StanislavBG/git-viewer, so you can poke around the code.',
].join(' ');

const MAILTO_PARAGRAPH = 'Questions? Email [the team](mailto:hello@bilko.run) any time.';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const PLAIN_PARAGRAPH = [
  'The new tool is easy to use. You can score a blog post in one click.',
  'It checks your words and sentences. The scanner tells you if the text is too hard to read.',
  'Most posts pass on the first try.',
].join(' ');

const JARGON_PARAGRAPH = [
  'Leveraging our robust, seamless, idempotent orchestration platform, we proactively utilize a',
  'holistic, scalable paradigm to facilitate synergistic optimization of latency-sensitive',
  'workflows while mitigating cross-functional bandwidth constraints across the entire',
  'enterprise ecosystem architecture.',
  'Utilizing deprecated infrastructure paradigms to streamline actionable bandwidth-constrained',
  'synergy requires robust mitigation strategies and seamless facilitation of holistic',
  'cross-functional orchestration frameworks throughout the entire enterprise technology stack lifecycle.',
].join(' ');

describe('analyzeReadability', () => {
  it('passes a short plain paragraph', () => {
    const report = analyzeReadability(PLAIN_PARAGRAPH);
    expect(report.pass).toBe(true);
    expect(report.fkGrade).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.maxFkGrade);
    expect(report.wordCount).toBeGreaterThan(0);
  });

  it('fails a dense jargon-heavy paragraph with long sentences', () => {
    const report = analyzeReadability(JARGON_PARAGRAPH);
    expect(report.pass).toBe(false);
    expect(report.fkGrade).toBeGreaterThan(8);
    expect(report.jargonHits.length).toBeGreaterThan(0);
    expect(report.longSentences.length).toBeGreaterThan(0);
  });

  it('does not let fenced code blocks or URLs change the score', () => {
    const base = analyzeReadability(PLAIN_PARAGRAPH);
    const withExtras =
      PLAIN_PARAGRAPH +
      '\n\n```js\nfunction leverageUtilizeOrchestrateIdempotentFacilitationBandwidthMitigation() { return 1; }\n```\n\n' +
      'https://example.com/some/really/long/complicated/path?query=abcdefgh\n';
    const extra = analyzeReadability(withExtras);
    expect(extra.fkGrade).toBe(base.fkGrade);
    expect(extra.wordCount).toBe(base.wordCount);
  });

  it('matches jargon case-insensitively and on whole words only', () => {
    const blocklist = [{ term: 'leverage', suggestion: 'use' }];

    const hit = analyzeReadability('Our team LEVERAGED the new system to ship faster.', {
      jargonBlocklist: blocklist,
    });
    expect(hit.jargonHits).toEqual([{ term: 'leverage', suggestion: 'use' }]);

    const miss = analyzeReadability('The cleverage of the design was notable.', {
      jargonBlocklist: blocklist,
    });
    expect(miss.jargonHits).toEqual([]);
  });
});

describe('analyzeReadability link checks', () => {
  it('flags a relative link and an unlinked open-source claim, and fails', () => {
    const report = analyzeReadability(BROKEN_LINK_PARAGRAPH);
    expect(report.pass).toBe(false);
    expect(report.linkIssues).toContainEqual({
      kind: 'relative-link',
      text: '[the project page](/projects/git-viewer/)',
    });
    expect(
      report.linkIssues.some((issue) => issue.kind === 'unlinked-source-claim'),
    ).toBe(true);
  });

  it('passes once the link is absolute and the source claim links to GitHub', () => {
    const report = analyzeReadability(FIXED_LINK_PARAGRAPH);
    expect(report.linkIssues).toEqual([]);
    expect(report.pass).toBe(true);
  });

  it('allows mailto links', () => {
    const report = analyzeReadability(MAILTO_PARAGRAPH);
    expect(report.linkIssues).toEqual([]);
  });
});

describe('blog-readability CLI', () => {
  it('exits 1 on a failing fixture file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'blog-readability-'));
    const file = join(dir, 'fail.md');
    writeFileSync(file, JARGON_PARAGRAPH, 'utf-8');

    let status: number | null = null;
    try {
      execFileSync('npx', ['tsx', 'scripts/blog-readability.ts', file], {
        cwd: REPO_ROOT,
        timeout: 60_000,
        stdio: 'pipe',
      });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(1);
  });

  it('exits 0 on a passing fixture file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'blog-readability-'));
    const file = join(dir, 'pass.md');
    writeFileSync(file, PLAIN_PARAGRAPH, 'utf-8');

    const output = execFileSync('npx', ['tsx', 'scripts/blog-readability.ts', file], {
      cwd: REPO_ROOT,
      timeout: 60_000,
      stdio: 'pipe',
    }).toString();

    const report = JSON.parse(output);
    expect(report.pass).toBe(true);
  });
});

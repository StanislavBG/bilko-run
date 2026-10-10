import { describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  analyzeReadability,
  findProjectLinkIssues,
  checkLiveLinks,
  collectHttpsLinks,
  stripFigures,
  DEFAULT_THRESHOLDS,
  type ProjectRegistryEntry,
} from '../scripts/blog-readability';

const BROKEN_LINK_PARAGRAPH = [
  'Check out [the project page](/projects/git-viewer/) for the full tour.',
  'Best of all, the project is open source, so you can poke around the code.',
].join(' ');

const FIXED_LINK_PARAGRAPH = [
  'Check out [the project page](https://bilko.run/projects/git-viewer/) for the full tour.',
  'Best of all, the project is open source at https://github.com/StanislavBG/git-viewer, so you can poke around the code.',
].join(' ');

const MAILTO_PARAGRAPH = 'Questions? Email [the team](mailto:hello@bilko.run) any time.';

const CLAIM_THEN_LATER_LINK_MARKDOWN = [
  'The new tool is easy to use. You can score a blog post in one click.',
  '',
  'Best of all, the project is open source, so you can poke around the code.',
  '',
  'Most posts pass on the first try. The code lives at https://github.com/StanislavBG/git-viewer for anyone curious.',
].join('\n');

const CLAIM_WITH_NO_LINK_ANYWHERE_MARKDOWN = [
  'The new tool is easy to use. You can score a blog post in one click.',
  '',
  'Best of all, the project is open source, so you can poke around the code.',
  '',
  'Most posts pass on the first try. Thanks for reading.',
].join('\n');

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli');

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

  it('passes a source claim in one paragraph when the repo link is in a later paragraph', () => {
    const report = analyzeReadability(CLAIM_THEN_LATER_LINK_MARKDOWN);
    expect(
      report.linkIssues.some((issue) => issue.kind === 'unlinked-source-claim'),
    ).toBe(false);
  });

  it('flags a source claim once when the post has no repo link anywhere', () => {
    const report = analyzeReadability(CLAIM_WITH_NO_LINK_ANYWHERE_MARKDOWN);
    const claimIssues = report.linkIssues.filter((issue) => issue.kind === 'unlinked-source-claim');
    expect(claimIssues).toHaveLength(1);
    expect(claimIssues[0].text).toBe(
      'Best of all, the project is open source, so you can poke around the code.',
    );
  });
});

describe('analyzeReadability figure blocks', () => {
  const FIGURE = '![A chart of weekly runs](/blog-images/x-y/a.jpg "Runs went up after the fix.")';

  it('passes a clean post that carries a valid figure block', () => {
    const report = analyzeReadability(PLAIN_PARAGRAPH + '\n\n' + FIGURE + '\n');
    expect(report.linkIssues).toEqual([]);
    expect(report.pass).toBe(true);
  });

  it.each([
    '![Chart](/images/x.jpg "Caption here.")',
    '![Chart](/blog-images/x-y/../a.jpg "Caption here.")',
  ])('still reports a link issue for an unsafe figure: %s', (block) => {
    const report = analyzeReadability(PLAIN_PARAGRAPH + '\n\n' + block + '\n');
    expect(report.linkIssues.some((issue) => issue.kind === 'relative-link')).toBe(true);
    expect(report.pass).toBe(false);
  });

  it('does not skip a figure with an off-site src, so its link is still live-checked', () => {
    const block = '![Chart](https://evil.test/x.png "Caption here.")';
    const body = PLAIN_PARAGRAPH + '\n\n' + block + '\n';
    expect(collectHttpsLinks(stripFigures(body))).toContain('https://evil.test/x.png');
    expect(analyzeReadability(body).wordCount).toBeGreaterThan(analyzeReadability(PLAIN_PARAGRAPH).wordCount);
  });

  it('never hands a valid figure src to the live link check', () => {
    expect(collectHttpsLinks(stripFigures(FIGURE))).toEqual([]);
  });

  it('does not count figure alt or caption words', () => {
    const base = analyzeReadability(PLAIN_PARAGRAPH);
    const withFigure = analyzeReadability(PLAIN_PARAGRAPH + '\n\n' + FIGURE + '\n');
    expect(withFigure.wordCount).toBe(base.wordCount);
    expect(withFigure.fkGrade).toBe(base.fkGrade);
  });
});

const TEST_REGISTRY: ProjectRegistryEntry[] = [
  { slug: 'git-viewer', host: { kind: 'static-path', path: '/projects/git-viewer/' } },
  { slug: 'sudoku', host: { kind: 'react-route', path: '/products/sudoku' } },
];

describe('analyzeReadability marketing checks', () => {
  it('fails when a blocklisted marketing phrase appears in the prose', () => {
    const report = analyzeReadability(
      'Sign up now and try the new scanner before the week is out.',
    );
    expect(report.pass).toBe(false);
    expect(report.marketingHits).toContain('sign up now');
  });

  it('passes a clean draft with no marketing phrases', () => {
    const report = analyzeReadability(PLAIN_PARAGRAPH);
    expect(report.marketingHits).toEqual([]);
    expect(report.pass).toBe(true);
  });
});

describe('findProjectLinkIssues', () => {
  it('flags a slug that is not in the registry', () => {
    const issues = findProjectLinkIssues(
      'Try it at https://bilko.run/projects/not-a-real-project/ today.',
      TEST_REGISTRY,
    );
    expect(issues).toContainEqual({
      kind: 'unknown-project-link',
      text: 'https://bilko.run/projects/not-a-real-project/',
    });
  });

  it('flags a static-path link missing its trailing slash', () => {
    const issues = findProjectLinkIssues(
      'Try it at https://bilko.run/projects/git-viewer today.',
      TEST_REGISTRY,
    );
    expect(issues).toContainEqual({
      kind: 'unknown-project-link',
      text: 'https://bilko.run/projects/git-viewer',
    });
  });

  it('passes a registered static-path link with its trailing slash', () => {
    const issues = findProjectLinkIssues(
      'Try it at https://bilko.run/projects/git-viewer/ today.',
      TEST_REGISTRY,
    );
    expect(issues).toEqual([]);
  });

  it('passes a registered react-route link in /products/<slug> form', () => {
    const issues = findProjectLinkIssues(
      'Play it at https://bilko.run/products/sudoku today.',
      TEST_REGISTRY,
    );
    expect(issues).toEqual([]);
  });

  it('flows through analyzeReadability and fails the whole report on an unknown slug', () => {
    const report = analyzeReadability(
      FIXED_LINK_PARAGRAPH + ' Also see https://bilko.run/projects/not-a-real-project/.',
      {},
      TEST_REGISTRY,
    );
    expect(report.pass).toBe(false);
    expect(
      report.linkIssues.some((issue) => issue.kind === 'unknown-project-link'),
    ).toBe(true);
  });
});

describe('checkLiveLinks', () => {
  it('passes a 200 response', async () => {
    const fake = async () => new Response('', { status: 200 });
    const failures = await checkLiveLinks(['https://example.com/ok'], fake as unknown as typeof fetch);
    expect(failures).toEqual([]);
  });

  it('fails a 404 response', async () => {
    const fake = async () => new Response('', { status: 404 });
    const failures = await checkLiveLinks(['https://example.com/missing'], fake as unknown as typeof fetch);
    expect(failures).toEqual([{ url: 'https://example.com/missing', status: 404 }]);
  });

  it('fails when fetch throws', async () => {
    const fake = async () => {
      throw new Error('network down');
    };
    const failures = await checkLiveLinks(['https://example.com/boom'], fake as unknown as typeof fetch);
    expect(failures).toEqual([{ url: 'https://example.com/boom', status: 'error' }]);
  });

  it('fails on an aborted/timed-out request', async () => {
    const fake = async (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    vi.useFakeTimers();
    try {
      const pending = checkLiveLinks(['https://example.com/slow'], fake as unknown as typeof fetch);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await pending).toEqual([{ url: 'https://example.com/slow', status: 'error' }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetches a duplicate URL only once', async () => {
    let calls = 0;
    const fake = async () => {
      calls += 1;
      return new Response('', { status: 200 });
    };
    const failures = await checkLiveLinks(
      ['https://example.com/dup', 'https://example.com/dup'],
      fake as unknown as typeof fetch,
    );
    expect(calls).toBe(1);
    expect(failures).toEqual([]);
  });

  it('reports too many links instead of fetching beyond the cap', async () => {
    let calls = 0;
    const fake = async () => {
      calls += 1;
      return new Response('', { status: 200 });
    };
    const urls = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`);
    const failures = await checkLiveLinks(urls, fake as unknown as typeof fetch);
    expect(calls).toBe(0);
    expect(failures).toEqual([{ url: 'too many links', status: 'error' }]);
  });
});

describe('blog-readability CLI', () => {
  it('exits 1 on a failing fixture file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'blog-readability-'));
    const file = join(dir, 'fail.md');
    writeFileSync(file, JARGON_PARAGRAPH, 'utf-8');

    let status: number | null = null;
    try {
      execFileSync(process.execPath, [TSX_CLI, 'scripts/blog-readability.ts', file], {
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

    const output = execFileSync(process.execPath, [TSX_CLI, 'scripts/blog-readability.ts', file], {
      cwd: REPO_ROOT,
      timeout: 60_000,
      stdio: 'pipe',
    }).toString();

    const report = JSON.parse(output);
    expect(report.pass).toBe(true);
  });
});

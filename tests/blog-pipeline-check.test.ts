import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PIPELINE_CONFIG,
  computeBlogBudget,
  checkPipeline,
  type PipelineArtifacts,
} from '../scripts/blog-pipeline-check';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli');
const CLI = join(REPO_ROOT, 'scripts/blog-pipeline-check.ts');

const words = (n: number, seed = 'word'): string =>
  Array.from({ length: n }, (_, i) => `${seed}${i % 7 === 0 ? 'a' : 'b'}`).join(' ') + '.';

function validArtifacts(): PipelineArtifacts {
  return {
    questions: {
      story_unit: 'heatmap badge wall',
      questions: [
        { id: 'q1', question: 'What is the value?', kind: 'value' },
        { id: 'q2', question: 'Who is it for?', kind: 'who' },
        { id: 'q3', question: 'How do I start?', kind: 'start' },
        { id: 'q4', question: 'What proves it?', kind: 'proof' },
      ],
    },
    evidence: {
      items: [
        { id: 'e1', question_ids: ['q1'], source_kind: 'diff', source: 'abc123', claim: 'Adds a heatmap.' },
        { id: 'e2', question_ids: ['q2'], source_kind: 'readme', source: 'README.md', claim: 'For builders.' },
        { id: 'e3', question_ids: ['q3'], source_kind: 'live-app', source: 'https://bilko.run/projects/x/', claim: 'Open it.' },
        { id: 'e4', question_ids: ['q4'], source_kind: 'scorecard', source: 'score.json', claim: 'Score is 9.' },
        { id: 'e5', question_ids: ['q1', 'q4'], source_kind: 'community', source: 'https://example.com/t', claim: 'Folks like it.', upvotes: 40 },
      ],
    },
    outline: {
      tone: 'shipped-note',
      title: 'A heatmap for your year',
      hook: 'Your year, in squares.',
      sections: [
        { id: 's1', heading: 'What it does', point: 'Shows the year.', evidence_ids: ['e1', 'e2'] },
        { id: 's2', heading: 'How to start', point: 'Open it.', evidence_ids: ['e3', 'e4'] },
      ],
      next: 'Try it.',
    },
    linkedin: `${words(150, 'li')} https://bilko.run/blog/x`,
    x: 'Your year in squares. https://bilko.run/blog/x',
  };
}

function validPost(bodyWords = 330): string {
  return [
    '---',
    'title: Test',
    '---',
    '',
    words(30, 'hook'),
    '',
    '## What it does',
    '',
    words(Math.floor(bodyWords / 2), 'one'),
    '',
    '## How to start',
    '',
    words(bodyWords - Math.floor(bodyWords / 2), 'two'),
  ].join('\n');
}

describe('computeBlogBudget', () => {
  it('computes the documented numbers', () => {
    expect(computeBlogBudget(3, DEFAULT_PIPELINE_CONFIG)).toEqual({ target: 530, min: 424, max: 636 });
    expect(computeBlogBudget(2, DEFAULT_PIPELINE_CONFIG)).toEqual({ target: 390, min: 312, max: 468 });
  });

  it('clamps to blogMin and blogMax', () => {
    const lo = computeBlogBudget(0, { ...DEFAULT_PIPELINE_CONFIG, budget: { ...DEFAULT_PIPELINE_CONFIG.budget, hookWords: 10, closeWords: 10 } });
    expect(lo.min).toBe(200);
    const hi = computeBlogBudget(20, DEFAULT_PIPELINE_CONFIG);
    expect(hi.max).toBe(1000);
  });
});

describe('checkPipeline', () => {
  it('passes a valid fixture', () => {
    const r = checkPipeline(validArtifacts(), validPost(), DEFAULT_PIPELINE_CONFIG);
    expect(r.errors).toEqual([]);
    expect(r.pass).toBe(true);
    expect(r.summary.questionCount).toBe(4);
    expect(r.summary.evidenceCount).toBe(5);
    expect(r.summary.communityKept).toBe(1);
    expect(r.summary.sections).toEqual([
      { heading: 'What it does', evidenceCount: 2 },
      { heading: 'How to start', evidenceCount: 2 },
    ]);
    expect(r.summary.budget).toEqual({ target: 390, min: 312, max: 468 });
    expect(r.summary.xChars).toBeGreaterThan(0);
  });

  it('fails when a required question kind is missing', () => {
    const a = validArtifacts();
    a.questions.questions = a.questions.questions.filter((q) => q.kind !== 'who');
    a.questions.questions.push({ id: 'q5', question: 'More?', kind: 'other' });
    const r = checkPipeline(a, validPost(), DEFAULT_PIPELINE_CONFIG);
    expect(r.pass).toBe(false);
    expect(r.errors.join('\n')).toMatch(/who/);
  });

  it('fails a community item below both floors', () => {
    const a = validArtifacts();
    a.evidence.items[4] = { ...a.evidence.items[4], upvotes: 3, quality: 0.2 };
    const r = checkPipeline(a, validPost(), DEFAULT_PIPELINE_CONFIG);
    expect(r.pass).toBe(false);
    expect(r.errors.join('\n')).toMatch(/e5/);
  });

  it('fails a section with only one evidence id', () => {
    const a = validArtifacts();
    a.outline.sections[0].evidence_ids = ['e1'];
    const r = checkPipeline(a, validPost(), DEFAULT_PIPELINE_CONFIG);
    expect(r.pass).toBe(false);
    expect(r.errors.join('\n')).toMatch(/s1/);
  });

  it('fails a post over budget', () => {
    const r = checkPipeline(validArtifacts(), validPost(600), DEFAULT_PIPELINE_CONFIG);
    expect(r.pass).toBe(false);
    expect(r.errors.join('\n')).toMatch(/word/i);
  });

  it('fails an X rendition over 280 characters', () => {
    const a = validArtifacts();
    a.x = 'x'.repeat(281);
    const r = checkPipeline(a, validPost(), DEFAULT_PIPELINE_CONFIG);
    expect(r.pass).toBe(false);
    expect(r.errors.join('\n')).toMatch(/280/);
  });

  it('fails a tone with more sections than allowed', () => {
    const a = validArtifacts();
    a.outline.tone = 'changelog';
    a.outline.sections.push({ id: 's3', heading: 'Third', point: 'p', evidence_ids: ['e1', 'e2'] });
    const post = validPost() + '\n\n## Third\n\n' + words(10);
    const r = checkPipeline(a, post, DEFAULT_PIPELINE_CONFIG);
    expect(r.pass).toBe(false);
    expect(r.errors.join('\n')).toMatch(/changelog/);
  });

  it('fails when a heading is missing from the post', () => {
    const post = validPost().replace('## How to start', '## Something else');
    const r = checkPipeline(validArtifacts(), post, DEFAULT_PIPELINE_CONFIG);
    expect(r.pass).toBe(false);
    expect(r.errors.join('\n')).toMatch(/How to start/);
  });
});

describe('CLI', () => {
  function writeDir(a: PipelineArtifacts): string {
    const dir = mkdtempSync(join(tmpdir(), 'pipeline-check-'));
    writeFileSync(join(dir, 'questions.json'), JSON.stringify(a.questions));
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify(a.evidence));
    writeFileSync(join(dir, 'outline.json'), JSON.stringify(a.outline));
    mkdirSync(join(dir, 'renditions'));
    writeFileSync(join(dir, 'renditions/linkedin.md'), a.linkedin ?? '');
    writeFileSync(join(dir, 'renditions/x.md'), a.x ?? '');
    writeFileSync(join(dir, 'post.md'), validPost());
    return dir;
  }

  function run(dir: string): number {
    try {
      execFileSync('node', [TSX_CLI, CLI, dir, join(dir, 'post.md')], { cwd: REPO_ROOT, stdio: 'pipe' });
      return 0;
    } catch (err) {
      return (err as { status: number }).status;
    }
  }

  it('exits 0 on a valid dir and 1 on an invalid one', () => {
    expect(run(writeDir(validArtifacts()))).toBe(0);
    const bad = validArtifacts();
    bad.x = 'x'.repeat(400);
    expect(run(writeDir(bad))).toBe(1);
  });

  it('exits 2 on a missing artifact', () => {
    const dir = writeDir(validArtifacts());
    writeFileSync(join(dir, 'questions.json'), '{not json');
    expect(run(dir)).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import type { SubagentResult, TargetStatus } from '../scripts/sanity-qa-runners/types.js';

// ── Pure helpers extracted from sanity-qa.ts for unit testing ───────────────

type Decision = 'PASS' | 'WARN' | 'FAIL';

function computeDecision(results: SubagentResult[]): Decision {
  const smokeResult   = results.find(r => r.name === 'smoke');
  const secResult     = results.find(r => r.name === 'security');
  const perfResult    = results.find(r => r.name === 'perf');
  const a11yResult    = results.find(r => r.name === 'a11y');

  if (smokeResult?.status === 'fail') return 'FAIL';
  if (secResult?.status === 'fail') return 'FAIL';
  if (secResult?.findings?.some(f => f.severity === 'critical' || f.severity === 'high')) return 'FAIL';
  if (a11yResult?.status === 'fail') return 'FAIL';
  if (perfResult?.status === 'fail') return 'FAIL';

  if (results.some(r => r.status === 'warn' || r.status === 'error')) return 'WARN';
  return 'PASS';
}

function targetOverall(slug: string, results: SubagentResult[]): TargetStatus {
  const statuses = results.map(r => r.perTarget[slug] ?? 'skip');
  if (statuses.some(s => s === 'fail')) return 'fail';
  if (statuses.some(s => s === 'warn' || s === 'error')) return 'warn';
  if (statuses.every(s => s === 'skip')) return 'skip';
  return 'pass';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(
  name: SubagentResult['name'],
  status: TargetStatus,
  perTarget: Record<string, TargetStatus> = {},
  findings = [],
): SubagentResult {
  return { name, status, perTarget, details: '', findings, sectionMd: '' };
}

const ALL_PASS: SubagentResult[] = [
  makeResult('smoke',    'pass', { foo: 'pass', bar: 'pass' }),
  makeResult('security', 'pass', { foo: 'pass', bar: 'pass' }),
  makeResult('perf',     'pass', { foo: 'pass', bar: 'pass' }),
  makeResult('size',     'pass', { foo: 'pass', bar: 'pass' }),
  makeResult('a11y',     'pass', { foo: 'pass', bar: 'pass' }),
];

// ── computeDecision ───────────────────────────────────────────────────────────

describe('computeDecision', () => {
  it('returns PASS when all subagents pass', () => {
    expect(computeDecision(ALL_PASS)).toBe('PASS');
  });

  it('returns FAIL when smoke fails', () => {
    const results = [...ALL_PASS];
    results[0] = makeResult('smoke', 'fail', { foo: 'fail' });
    expect(computeDecision(results)).toBe('FAIL');
  });

  it('returns FAIL when security fails', () => {
    const results = [...ALL_PASS];
    results[1] = makeResult('security', 'fail', { foo: 'fail' });
    expect(computeDecision(results)).toBe('FAIL');
  });

  it('returns FAIL when security has critical finding', () => {
    const results = [...ALL_PASS];
    results[1] = makeResult('security', 'pass', { foo: 'pass' }, [
      { severity: 'critical', target: 'foo', kind: 'ssrf', detail: 'SSRF probe passed' },
    ] as never);
    expect(computeDecision(results)).toBe('FAIL');
  });

  it('returns FAIL when security has high finding even if status is warn', () => {
    const results = [...ALL_PASS];
    results[1] = makeResult('security', 'warn', { foo: 'warn' }, [
      { severity: 'high', target: 'foo', kind: 'csp-missing', detail: 'CSP absent' },
    ] as never);
    expect(computeDecision(results)).toBe('FAIL');
  });

  it('returns FAIL when perf fails', () => {
    const results = [...ALL_PASS];
    results[2] = makeResult('perf', 'fail', { foo: 'fail' });
    expect(computeDecision(results)).toBe('FAIL');
  });

  it('returns FAIL when a11y fails', () => {
    const results = [...ALL_PASS];
    results[4] = makeResult('a11y', 'fail', { foo: 'fail' });
    expect(computeDecision(results)).toBe('FAIL');
  });

  it('returns WARN when any subagent warns but no failure', () => {
    const results = [...ALL_PASS];
    results[2] = makeResult('perf', 'warn', { foo: 'warn' });
    expect(computeDecision(results)).toBe('WARN');
  });

  it('returns WARN when size warns but nothing fails', () => {
    const results = [...ALL_PASS];
    results[3] = makeResult('size', 'warn', { foo: 'warn' });
    expect(computeDecision(results)).toBe('WARN');
  });

  it('returns WARN for security med finding when security status is warn', () => {
    const results = [...ALL_PASS];
    results[1] = makeResult('security', 'warn', { foo: 'warn' }, [
      { severity: 'med', target: 'foo', kind: 'hsts-short', detail: 'max-age too short' },
    ] as never);
    expect(computeDecision(results)).toBe('WARN');
  });
});

// ── targetOverall ─────────────────────────────────────────────────────────────

describe('targetOverall', () => {
  it('pass when all subagents pass for target', () => {
    expect(targetOverall('foo', ALL_PASS)).toBe('pass');
  });

  it('fail when any subagent fails for target', () => {
    const results = [...ALL_PASS];
    results[0] = makeResult('smoke', 'fail', { foo: 'fail', bar: 'pass' });
    expect(targetOverall('foo', results)).toBe('fail');
  });

  it('warn when any subagent warns and none fails', () => {
    const results = [...ALL_PASS];
    results[2] = makeResult('perf', 'warn', { foo: 'warn', bar: 'pass' });
    expect(targetOverall('foo', results)).toBe('warn');
  });

  it('skip when target is absent from all perTarget maps', () => {
    const results = ALL_PASS.map(r => makeResult(r.name, r.status, { other: 'pass' }));
    expect(targetOverall('missing', results)).toBe('skip');
  });

  it('returns pass even when some subagents skip the target', () => {
    const partial: SubagentResult[] = [
      makeResult('smoke',    'pass', { foo: 'pass' }),
      makeResult('security', 'pass', {}),           // foo not in map → skip
      makeResult('perf',     'pass', { foo: 'pass' }),
      makeResult('size',     'pass', { foo: 'pass' }),
      makeResult('a11y',     'pass', { foo: 'pass' }),
    ];
    expect(targetOverall('foo', partial)).toBe('pass');
  });
});

// ── Report shape ──────────────────────────────────────────────────────────────

describe('report table', () => {
  it('produces one row per target with correct icons', () => {
    // Simulate what buildReport does for the table
    const results = [
      makeResult('smoke',    'pass', { sudoku: 'pass', mindswiffer: 'warn' }),
      makeResult('security', 'pass', { sudoku: 'pass', mindswiffer: 'pass' }),
      makeResult('perf',     'warn', { sudoku: 'warn', mindswiffer: 'pass' }),
      makeResult('size',     'pass', { sudoku: 'pass', mindswiffer: 'pass' }),
      makeResult('a11y',     'pass', { sudoku: 'pass', mindswiffer: 'pass' }),
    ];

    const overallSudoku = targetOverall('sudoku', results);
    const overallMind   = targetOverall('mindswiffer', results);

    // sudoku: perf=warn → overall warn
    expect(overallSudoku).toBe('warn');
    // mindswiffer: smoke=warn → overall warn
    expect(overallMind).toBe('warn');
  });

  it('FAIL beats WARN in overall target status', () => {
    const results = [
      makeResult('smoke',    'pass', { foo: 'fail' }),
      makeResult('security', 'warn', { foo: 'warn' }),
      makeResult('perf',     'pass', { foo: 'pass' }),
      makeResult('size',     'pass', { foo: 'pass' }),
      makeResult('a11y',     'pass', { foo: 'pass' }),
    ];
    expect(targetOverall('foo', results)).toBe('fail');
  });
});

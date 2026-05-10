#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { runSmoke } from './sanity-qa-runners/smoke.js';
import { runSecurity } from './sanity-qa-runners/security.js';
import { runPerf } from './sanity-qa-runners/perf.js';
import { runSize } from './sanity-qa-runners/size.js';
import { runA11y } from './sanity-qa-runners/a11y.js';
import type { SanityTarget, SubagentResult, TargetStatus } from './sanity-qa-runners/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BILKO_ROOT = resolve(__dirname, '..');
const BASE_URL = process.env.BILKO_BASE ?? 'https://bilko.run';

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const targetsArg   = args.find(a => a.startsWith('--targets='))?.slice('--targets='.length) ?? '';
const writeReportArg = args.find(a => a.startsWith('--write-report='))?.slice('--write-report='.length);
const failFast     = args.includes('--fail-fast');

// ── Target resolution ────────────────────────────────────────────────────────

function expandTilde(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

function buildTargets(filterSlugs: string[]): SanityTarget[] {
  const rawPath = resolve(BILKO_ROOT, 'src/data/standalone-projects.json');
  const standalone = JSON.parse(readFileSync(rawPath, 'utf-8')) as Array<{
    slug: string;
    name: string;
    category: string;
    status: string;
    host: { kind: string; path?: string; localPath?: string };
  }>;

  return standalone
    .filter(p => p.status === 'live' && p.host?.kind === 'static-path')
    .filter(p => filterSlugs.length === 0 || filterSlugs.includes(p.slug))
    .map(p => ({
      slug: p.slug,
      name: p.name,
      url: `${BASE_URL}${p.host.path}`,
      category: p.category,
      localPublicPath: resolve(BILKO_ROOT, 'public', 'projects', p.slug),
      localSourcePath: p.host.localPath ? expandTilde(p.host.localPath) : undefined,
    }));
}

// ── Report building ─────────────────────────────────────────────────────────

type Decision = 'PASS' | 'WARN' | 'FAIL';

function computeDecision(results: SubagentResult[]): Decision {
  const smokeResult   = results.find(r => r.name === 'smoke');
  const secResult     = results.find(r => r.name === 'security');
  const perfResult    = results.find(r => r.name === 'perf');
  const a11yResult    = results.find(r => r.name === 'a11y');

  // Hard fails per PRD
  if (smokeResult?.status === 'fail') return 'FAIL';
  if (secResult?.status === 'fail') return 'FAIL';
  if (secResult?.findings?.some(f => f.severity === 'critical' || f.severity === 'high')) return 'FAIL';
  if (a11yResult?.status === 'fail') return 'FAIL';
  // Perf < 80 means perTarget will be 'fail' for that target
  if (perfResult?.status === 'fail') return 'FAIL';

  // Any warn → WARN
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

function statusIcon(s: TargetStatus | undefined): string {
  if (!s || s === 'skip') return '—';
  if (s === 'pass') return '✅';
  if (s === 'warn' || s === 'error') return '🟡';
  return '❌';
}

function buildReport(targets: SanityTarget[], results: SubagentResult[], decision: Decision): string {
  const now = new Date();
  const dateLine = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  const lines: string[] = [`# Sanity QA — ${dateLine}`, ''];

  // Summary table
  lines.push('| Target | Smoke | Security | Perf | Size | A11y | Overall |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const t of targets) {
    const smoke    = results.find(r => r.name === 'smoke')?.perTarget[t.slug];
    const security = results.find(r => r.name === 'security')?.perTarget[t.slug];
    const perf     = results.find(r => r.name === 'perf')?.perTarget[t.slug];
    const size     = results.find(r => r.name === 'size')?.perTarget[t.slug];
    const a11y     = results.find(r => r.name === 'a11y')?.perTarget[t.slug];
    const overall  = targetOverall(t.slug, results);
    const overallMd = overall === 'pass' ? '**PASS**' : overall === 'warn' || overall === 'error' ? '**WARN**' : '**FAIL**';
    lines.push(`| ${t.slug.padEnd(18)} | ${statusIcon(smoke)} | ${statusIcon(security)} | ${statusIcon(perf)} | ${statusIcon(size)} | ${statusIcon(a11y)} | ${overallMd} |`);
  }
  lines.push('');

  // Sub-sections
  for (const result of results) {
    lines.push(result.sectionMd);
    lines.push('');
  }

  // Decision
  const decisionMd = decision === 'PASS' ? '✅ **PASS**' : decision === 'WARN' ? '🟡 **WARN**' : '❌ **FAIL**';
  lines.push(`## Decision\n\n${decisionMd}`);
  lines.push('');

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filterSlugs = targetsArg ? targetsArg.split(',').filter(Boolean) : [];
  const targets = buildTargets(filterSlugs);

  if (targets.length === 0) {
    console.error('No live static-path targets found (or --targets filter matched nothing).');
    process.exit(2);
  }

  console.log(`Sanity QA: ${targets.length} target(s) — ${targets.map(t => t.slug).join(', ')}`);
  if (failFast) console.log('(fail-fast mode)');

  // Run all 5 subagents in parallel
  const [smoke, security, perf, size, a11y] = await Promise.all([
    runSmoke(targets, failFast),
    runSecurity(targets, failFast),
    runPerf(targets, failFast),
    runSize(targets, failFast),
    runA11y(targets, failFast),
  ]);

  const results: SubagentResult[] = [smoke, security, perf, size, a11y];
  const decision = computeDecision(results);

  // Build report
  const report = buildReport(targets, results, decision);

  // Write to file
  const now = new Date();
  const la = now.toLocaleString('en-CA', { timeZone: 'America/Los_Angeles', hour12: false }).replace(/, /, 'T');
  const [datePart, timePart] = la.split('T');
  const timeSlug = timePart.slice(0, 5).replace(':', '-');
  const defaultPath = resolve(BILKO_ROOT, 'test-results', `sanity-qa-${datePart}-${timeSlug}.md`);
  const reportPath = writeReportArg ? resolve(writeReportArg) : defaultPath;

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, 'utf-8');
  console.log(`Report: ${reportPath}`);
  console.log(`Decision: ${decision}`);

  // Exit codes: 0=pass, 1=fail, 2=internal error
  if (decision === 'FAIL') process.exit(1);
  process.exit(0);
}

main().catch(e => {
  console.error('sanity-qa internal error:', e);
  process.exit(2);
});

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';
import type { SanityTarget, SubagentResult, TargetStatus } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LH_BIN = resolve(__dirname, '../../node_modules/.bin/lighthouse');

interface PerfScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcpMs: number;
  cls: number;
  ttiMs: number;
}

// Thresholds from PRD
const THRESHOLDS = {
  performance: { pass: 85, warn: 80 },
  accessibility: { pass: 95, warn: 90 },
  bestPractices: { pass: 90, warn: 85 },
  seo: { pass: 90, warn: 85 },
  lcpMs: { pass: 2500, warn: 3000 },
  cls: { pass: 0.1, warn: 0.15 },
  ttiMs: { pass: 3500, warn: 5000 },
};

function scoreStatus(scores: PerfScores): TargetStatus {
  if (
    scores.performance < THRESHOLDS.performance.warn ||
    scores.accessibility < THRESHOLDS.accessibility.warn ||
    scores.bestPractices < THRESHOLDS.bestPractices.warn ||
    scores.seo < THRESHOLDS.seo.warn ||
    scores.lcpMs > THRESHOLDS.lcpMs.warn ||
    scores.cls > THRESHOLDS.cls.warn ||
    scores.ttiMs > THRESHOLDS.ttiMs.warn
  ) return 'fail';

  if (
    scores.performance < THRESHOLDS.performance.pass ||
    scores.accessibility < THRESHOLDS.accessibility.pass ||
    scores.bestPractices < THRESHOLDS.bestPractices.pass ||
    scores.seo < THRESHOLDS.seo.pass ||
    scores.lcpMs > THRESHOLDS.lcpMs.pass ||
    scores.cls > THRESHOLDS.cls.pass ||
    scores.ttiMs > THRESHOLDS.ttiMs.pass
  ) return 'warn';

  return 'pass';
}

async function runLighthouse(url: string): Promise<PerfScores | null> {
  const tmpDir = tmpdir();
  const tmpFile = join(tmpDir, `lh-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const chromiumPath = chromium.executablePath();

  try {
    execFileSync(LH_BIN, [
      url,
      '--output', 'json',
      '--output-path', tmpFile,
      '--chrome-path', chromiumPath,
      '--chrome-flags', '--headless --no-sandbox --disable-dev-shm-usage --disable-gpu',
      '--form-factor', 'mobile',
      '--throttling-method', 'simulate',
      '--only-categories', 'performance,accessibility,best-practices,seo',
      '--quiet',
    ], {
      timeout: 120_000,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    if (!existsSync(tmpFile)) return null;
    const lhr = JSON.parse(readFileSync(tmpFile, 'utf-8'));

    return {
      performance:    Math.round((lhr.categories['performance']?.score ?? 0) * 100),
      accessibility:  Math.round((lhr.categories['accessibility']?.score ?? 0) * 100),
      bestPractices:  Math.round((lhr.categories['best-practices']?.score ?? 0) * 100),
      seo:            Math.round((lhr.categories['seo']?.score ?? 0) * 100),
      lcpMs:          lhr.audits['largest-contentful-paint']?.numericValue ?? 99999,
      cls:            lhr.audits['cumulative-layout-shift']?.numericValue ?? 99,
      ttiMs:          lhr.audits['interactive']?.numericValue ?? 99999,
    };
  } catch {
    return null;
  } finally {
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}
  }
}

export async function runPerf(targets: SanityTarget[], failFast = false): Promise<SubagentResult> {
  const perTarget: Record<string, TargetStatus> = {};
  const rows: string[] = [];

  // Run 2 Lighthouse audits at a time (CPU intensive)
  for (let i = 0; i < targets.length; i += 2) {
    const batch = targets.slice(i, i + 2);
    const results = await Promise.all(batch.map(async target => {
      const scores = await runLighthouse(target.url);
      return { target, scores };
    }));

    for (const { target, scores } of results) {
      if (!scores) {
        perTarget[target.slug] = 'error';
        rows.push(`| ${target.slug} | — | — | — | — | — | — | — | ⚠️ Lighthouse failed |`);
        continue;
      }

      const status = scoreStatus(scores);
      perTarget[target.slug] = status;
      const icon = status === 'pass' ? '✅' : status === 'warn' ? '🟡' : '❌';
      rows.push(
        `| ${target.slug} | ${scores.performance} | ${scores.accessibility} | ${scores.bestPractices} | ${scores.seo}` +
        ` | ${(scores.lcpMs / 1000).toFixed(1)}s | ${scores.cls.toFixed(2)} | ${(scores.ttiMs / 1000).toFixed(1)}s | ${icon} |`
      );

      if (failFast && status === 'fail') break;
    }
    if (failFast && Object.values(perTarget).some(s => s === 'fail')) break;
  }

  const allStatuses = Object.values(perTarget);
  const status: TargetStatus = allStatuses.some(s => s === 'fail') ? 'fail'
    : allStatuses.some(s => s === 'warn' || s === 'error') ? 'warn'
    : 'pass';

  const sectionMd = [
    '## Performance\n',
    '| Target | Perf | A11y | BP | SEO | LCP | CLS | TTI | Status |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `Thresholds — Perf ≥${THRESHOLDS.performance.pass}, A11y ≥${THRESHOLDS.accessibility.pass}, BP ≥${THRESHOLDS.bestPractices.pass}, SEO ≥${THRESHOLDS.seo.pass}`,
    `LCP ≤${THRESHOLDS.lcpMs.pass / 1000}s, CLS ≤${THRESHOLDS.cls.pass}, TTI ≤${THRESHOLDS.ttiMs.pass / 1000}s (mobile / Slow-4G simulate)`,
  ].join('\n');

  return {
    name: 'perf',
    status,
    perTarget,
    details: `${allStatuses.filter(s => s === 'pass').length}/${targets.length} within targets`,
    sectionMd,
  };
}

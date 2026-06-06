import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import type { SanityTarget, SubagentResult, TargetStatus } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LH_BIN = resolve(__dirname, '../../node_modules/.bin/lighthouse');
// Static-path bundles live under <repo>/public; serving that dir at the server
// root makes the in-production `/projects/<slug>/` paths (and any absolute asset
// URLs they contain) resolve exactly as they do live.
const PUBLIC_ROOT = resolve(__dirname, '../../public');

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

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

/**
 * Minimal dependency-free static file server rooted at PUBLIC_ROOT. Used only to
 * feed Lighthouse a COOP-free localhost origin so the document request isn't
 * aborted by Chrome's cross-origin-opener-policy process swap (the failure that
 * made every live-URL run report "Lighthouse failed"). Directory requests fall
 * back to index.html; a missing file 404s.
 *
 * Complexity: O(1) path resolution per request; streams the file. Bounded by
 * the number of asset requests Lighthouse makes per page (small/constant).
 */
function startStaticServer(): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolveServer) => {
    const server: Server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let fsPath = normalize(join(PUBLIC_ROOT, urlPath));
        // Directory-traversal guard: never serve outside PUBLIC_ROOT.
        if (fsPath !== PUBLIC_ROOT && !fsPath.startsWith(PUBLIC_ROOT + '/')) {
          res.statusCode = 403; res.end('forbidden'); return;
        }
        if (existsSync(fsPath) && statSync(fsPath).isDirectory()) fsPath = join(fsPath, 'index.html');
        if (!existsSync(fsPath) || !statSync(fsPath).isFile()) {
          res.statusCode = 404; res.end('not found'); return;
        }
        res.setHeader('Content-Type', MIME[extname(fsPath).toLowerCase()] ?? 'application/octet-stream');
        createReadStream(fsPath).pipe(res);
      } catch {
        res.statusCode = 500; res.end('error');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolveServer({
        port,
        close: () => new Promise<void>(done => server.close(() => done())),
      });
    });
  });
}

async function runLighthouse(url: string): Promise<PerfScores | null> {
  const tmpFile = join(tmpdir(), `lh-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const chromiumPath = chromium.executablePath();

  try {
    // Lighthouse's CLI has no --chrome-path flag; it resolves Chrome from the
    // CHROME_PATH env var. Point it at Playwright's bundled Chromium (the only
    // Chrome on this box) — without this every run fails "Chrome not found".
    execFileSync(LH_BIN, [
      url,
      '--output', 'json',
      '--output-path', tmpFile,
      '--chrome-flags', '--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu',
      '--form-factor', 'mobile',
      '--throttling-method', 'simulate',
      '--only-categories', 'performance,accessibility,best-practices,seo',
      '--quiet',
    ], {
      timeout: 120_000,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, CHROME_PATH: chromiumPath },
    });

    if (!existsSync(tmpFile)) return null;
    const lhr = JSON.parse(readFileSync(tmpFile, 'utf-8'));
    // A runtimeError means Lighthouse loaded but couldn't measure — surface it
    // as a failed measurement rather than silently scoring 0s.
    if (lhr.runtimeError?.code) {
      console.error(`[perf] Lighthouse runtime error for ${url}: ${lhr.runtimeError.code} — ${lhr.runtimeError.message ?? ''}`);
      return null;
    }

    return {
      performance:    Math.round((lhr.categories['performance']?.score ?? 0) * 100),
      accessibility:  Math.round((lhr.categories['accessibility']?.score ?? 0) * 100),
      bestPractices:  Math.round((lhr.categories['best-practices']?.score ?? 0) * 100),
      seo:            Math.round((lhr.categories['seo']?.score ?? 0) * 100),
      lcpMs:          lhr.audits['largest-contentful-paint']?.numericValue ?? 99999,
      cls:            lhr.audits['cumulative-layout-shift']?.numericValue ?? 99,
      ttiMs:          lhr.audits['interactive']?.numericValue ?? 99999,
    };
  } catch (e: unknown) {
    console.error(`[perf] Lighthouse failed for ${url}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    return null;
  } finally {
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/** Map a target's live URL to the equivalent path on the local static server. */
function localUrl(port: number, target: SanityTarget): string {
  let pathname = '/';
  try { pathname = new URL(target.url).pathname; } catch { /* keep root */ }
  return `http://127.0.0.1:${port}${pathname}`;
}

export async function runPerf(targets: SanityTarget[], failFast = false): Promise<SubagentResult> {
  const perTarget: Record<string, TargetStatus> = {};
  const rows: string[] = [];

  // Serve the built bundles locally so Lighthouse hits a COOP-free origin.
  const srv = await startStaticServer();

  try {
    // Run 2 Lighthouse audits at a time (CPU intensive)
    for (let i = 0; i < targets.length; i += 2) {
      const batch = targets.slice(i, i + 2);
      const results = await Promise.all(batch.map(async target => {
        const scores = await runLighthouse(localUrl(srv.port, target));
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
  } finally {
    await srv.close();
  }

  const allStatuses = Object.values(perTarget);
  const status: TargetStatus = allStatuses.some(s => s === 'fail') ? 'fail'
    : allStatuses.some(s => s === 'warn' || s === 'error') ? 'warn'
    : 'pass';

  const sectionMd = [
    '## Performance\n',
    '_Measured against the built bundles served from a local COOP-free origin._\n',
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

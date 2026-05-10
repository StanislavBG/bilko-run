import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { SanityTarget, SubagentResult, TargetStatus } from './types.js';

const BUDGETS_BYTES: Record<string, number> = {
  // Games — 250 KB gz
  sudoku:        250 * 1024,
  mindswiffer:   250 * 1024,
  'game-academy': 250 * 1024,
  // Academy — 400 KB gz
  academy:       400 * 1024,
  // Default AI tools / others — 200 KB gz
  _default:      200 * 1024,
};

const MAX_FILE_COUNT = 30;
const STALE_DAYS = 14;

interface ManifestData {
  schemaVersion: number;
  slug: string;
  version: string;
  builtAt: string;
  bundle: { sizeBytesGz: number; fileCount: number };
}

function countFilesRecursive(dir: string): number {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        count += countFilesRecursive(join(dir, entry.name));
      } else {
        count++;
      }
    }
  } catch {}
  return count;
}

function expandTilde(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

function isStaleManifest(builtAt: string, localSourcePath?: string): boolean {
  const builtMs = new Date(builtAt).getTime();
  const staleThresholdMs = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  if (builtMs >= staleThresholdMs) return false; // fresh enough

  if (!localSourcePath) return false; // can't check git

  const srcPath = expandTilde(localSourcePath);
  if (!existsSync(srcPath)) return false;

  try {
    const recentCommits = execSync(
      `git -C "${srcPath}" log --since="${STALE_DAYS} days ago" --oneline -- src/ 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5_000 }
    ).trim();
    return recentCommits.length > 0;
  } catch {
    return false;
  }
}

export async function runSize(targets: SanityTarget[], failFast = false): Promise<SubagentResult> {
  const perTarget: Record<string, TargetStatus> = {};
  const rows: string[] = [];

  for (const target of targets) {
    const manifestPath = join(target.localPublicPath, 'manifest.json');
    if (!existsSync(manifestPath)) {
      perTarget[target.slug] = 'warn';
      rows.push(`| ${target.slug} | — | — | — | 🟡 no manifest.json |`);
      continue;
    }

    let manifest: ManifestData;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    } catch {
      perTarget[target.slug] = 'fail';
      rows.push(`| ${target.slug} | — | — | — | ❌ manifest.json parse error |`);
      continue;
    }

    const budget = BUDGETS_BYTES[target.slug] ?? BUDGETS_BYTES._default;
    const { sizeBytesGz, fileCount } = manifest.bundle;
    const sizeKB = (sizeBytesGz / 1024).toFixed(1);
    const budgetKB = (budget / 1024).toFixed(0);

    let issues: string[] = [];

    // Size check
    if (sizeBytesGz > budget) {
      issues.push(`${sizeKB} KB gz > ${budgetKB} KB budget`);
    }

    // File count check
    if (fileCount > MAX_FILE_COUNT) {
      issues.push(`${fileCount} files > ${MAX_FILE_COUNT} max`);
    }

    // Cross-check actual file count
    const actualFileCount = countFilesRecursive(target.localPublicPath);
    if (Math.abs(actualFileCount - fileCount) > 5) {
      issues.push(`manifest.fileCount=${fileCount} but actual=${actualFileCount}`);
    }

    // Stale drift check
    if (isStaleManifest(manifest.builtAt, target.localSourcePath)) {
      issues.push(`manifest stale (builtAt=${manifest.builtAt.slice(0, 10)}) but recent src commits found`);
    }

    const status: TargetStatus = issues.length === 0 ? 'pass'
      : issues.some(i => i.includes('KB gz >')) ? 'fail'
      : 'warn';

    perTarget[target.slug] = status;
    const icon = status === 'pass' ? '✅' : status === 'warn' ? '🟡' : '❌';
    const note = issues.length > 0 ? issues.join('; ') : '';
    rows.push(`| ${target.slug} | ${sizeKB} KB | ${budgetKB} KB | ${fileCount} | ${icon} ${note} |`);

    if (failFast && status === 'fail') break;
  }

  const allStatuses = Object.values(perTarget);
  const status: TargetStatus = allStatuses.some(s => s === 'fail') ? 'fail'
    : allStatuses.some(s => s === 'warn' || s === 'error') ? 'warn'
    : 'pass';

  const sectionMd = [
    '## Bundle Size\n',
    '| Target | Size (gz) | Budget | Files | Status |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'Budgets: games=250 KB, academy=400 KB, others=200 KB. Max files=30.',
  ].join('\n');

  return {
    name: 'size',
    status,
    perTarget,
    details: `${allStatuses.filter(s => s === 'pass').length}/${targets.length} within budget`,
    sectionMd,
  };
}

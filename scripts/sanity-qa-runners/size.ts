import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SanityTarget, SubagentResult, TargetStatus } from './types.js';

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
      rows.push(`| ${target.slug} | — | — | 🟡 no manifest.json |`);
      continue;
    }

    let manifest: ManifestData;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    } catch {
      perTarget[target.slug] = 'fail';
      rows.push(`| ${target.slug} | — | — | ❌ manifest.json parse error |`);
      if (failFast) break;
      continue;
    }

    // No per-app size budget and no file-count limit (owner decision
    // 2026-11-15): size is reported only; drift checks below can warn.
    const { sizeBytesGz, fileCount } = manifest.bundle;
    const sizeKB = (sizeBytesGz / 1024).toFixed(1);

    const issues: string[] = [];

    // Cross-check actual file count
    const actualFileCount = countFilesRecursive(target.localPublicPath);
    if (Math.abs(actualFileCount - fileCount) > 5) {
      issues.push(`manifest.fileCount=${fileCount} but actual=${actualFileCount}`);
    }

    // Stale drift check
    if (isStaleManifest(manifest.builtAt, target.localSourcePath)) {
      issues.push(`manifest stale (builtAt=${manifest.builtAt.slice(0, 10)}) but recent src commits found`);
    }

    const status: TargetStatus = issues.length === 0 ? 'pass' : 'warn';

    perTarget[target.slug] = status;
    const icon = status === 'pass' ? '✅' : '🟡';
    const note = issues.length > 0 ? issues.join('; ') : '';
    rows.push(`| ${target.slug} | ${sizeKB} KB | ${fileCount} | ${icon} ${note} |`);
  }

  const allStatuses = Object.values(perTarget);
  const passCount = allStatuses.filter(s => s === 'pass').length;
  const status: TargetStatus = allStatuses.some(s => s === 'fail') ? 'fail'
    : allStatuses.some(s => s === 'warn' || s === 'error') ? 'warn'
    : 'pass';

  const sectionMd = [
    '## Bundle Size\n',
    '| Target | Size (gz) | Files | Status |',
    '|---|---|---|---|',
    ...rows,
    '',
    'No per-app size budget (owner decision 2026-11-15): this check reports gzipped size and checks manifest drift only.',
  ].join('\n');

  return {
    name: 'size',
    status,
    perTarget,
    details: `${passCount}/${targets.length} targets pass`,
    sectionMd,
  };
}

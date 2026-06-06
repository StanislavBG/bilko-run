#!/usr/bin/env tsx
/**
 * Refreshes src/data/commit-order.json — a slug → last-commit-ISO map used by
 * the Projects hub to sort cards "most recently worked on" first.
 *
 * Why a baked sidecar: bilko.run builds on Render straight from GitHub, where
 * the sibling repos under ~/Projects/ do not exist, so we can't run `git log`
 * at build/runtime there. Instead this script runs where the siblings DO live
 * (the dev machine / nightly cron), reads each repo's last commit, and commits
 * the resulting JSON. The page just imports the JSON.
 *
 * Slugs come from two sources:
 *   - standalone-projects.json entries that carry a `localPath`
 *   - the EXTRA map below for packages / special subdir-scoped cards
 *
 * Complexity: O(n) git invocations, n = number of mapped slugs (~25). Trivial.
 *
 * Run: pnpm exec tsx scripts/refresh-commit-order.ts
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function expandTilde(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

interface Source {
  /** Absolute or ~-prefixed path to the git repo. */
  path: string;
  /** Optional subdirectory to scope the commit lookup to. */
  subdir?: string;
}

// Slugs whose repo isn't a standalone-projects.json localPath: npm packages and
// the MCP host server (which lives inside this very repo, under mcp-host-server/).
const EXTRA: Record<string, Source> = {
  'mcp-host':   { path: ROOT, subdir: 'mcp-host-server' },
  'host-kit':   { path: '~/Projects/Bilko-Host-Kit' },
  'bilko-flow': { path: '~/Projects/bilko-flow' },
  'session-manager': { path: '~/Projects/session-manager' },
};

function lastCommitISO(src: Source): string | null {
  const repo = expandTilde(src.path);
  if (!existsSync(join(repo, '.git'))) return null;
  try {
    const args = ['-C', repo, 'log', '-1', '--format=%cI'];
    if (src.subdir) args.push('--', src.subdir);
    const out = execFileSync('git', args, { encoding: 'utf-8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// 1. Collect sources from standalone-projects.json (those with a localPath).
const standalone = JSON.parse(
  readFileSync(resolve(ROOT, 'src/data/standalone-projects.json'), 'utf-8'),
) as Array<{ slug: string; host?: { localPath?: string } }>;

const sources = new Map<string, Source>();
for (const p of standalone) {
  if (p.host?.localPath) sources.set(p.slug, { path: p.host.localPath });
}
// 2. Layer the extras (packages + mcp-host). These win on slug collisions.
for (const [slug, src] of Object.entries(EXTRA)) sources.set(slug, src);

// 3. Resolve each to an ISO date; drop the ones we can't find.
const order: Record<string, string> = {};
let missing = 0;
for (const [slug, src] of sources) {
  const iso = lastCommitISO(src);
  if (iso) order[slug] = iso;
  else { missing++; console.warn(`[refresh-commit-order] no git date for "${slug}" (${src.path})`); }
}

// Sort keys by date desc so the JSON is human-readable as a leaderboard.
const sorted = Object.fromEntries(
  Object.entries(order).sort((a, b) => (a[1] < b[1] ? 1 : -1)),
);

const outPath = resolve(ROOT, 'src/data/commit-order.json');
writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n');
console.log(`[refresh-commit-order] wrote ${Object.keys(sorted).length} entries (${missing} missing) → ${outPath}`);

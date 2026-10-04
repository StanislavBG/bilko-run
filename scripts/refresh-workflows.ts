#!/usr/bin/env tsx
/**
 * Refreshes src/data/workflows.json — the jobs behind /workflows — from this
 * machine's real schedules: `crontab -l`, systemd user timers, and the
 * scheduled GitHub Actions workflows of sibling repos.
 *
 * Same reason as refresh-commit-order.ts: Render builds without the crontab
 * or the sibling repos, so this runs locally (nightly via sanity-qa-cron.sh)
 * and the page imports the committed JSON. Only allowlisted jobs are written
 * (scripts/workflows-allowlist.ts); schedule paths and log locations never
 * leave this script.
 *
 * Run: pnpm exec tsx scripts/refresh-workflows.ts
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import {
  buildWorkflows, parseCrontab, parseGithubSchedule, parseSystemdTimer, type ScheduleEntry,
} from './lib/workflows.js';
import { WORKFLOW_ALLOWLIST, WORKFLOW_GROUPS } from './workflows-allowlist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Sibling GitHub Actions workflows with a `schedule:` trigger. */
const GHA: Record<string, string> = {
  'git-viewer/pages.yml': '~/Projects/git-viewer/.github/workflows/pages.yml',
};

function expandTilde(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

const entries: ScheduleEntry[] = [];

let crontab = '';
try {
  crontab = execFileSync('crontab', ['-l'], { encoding: 'utf-8' });
} catch {
  console.error('[refresh-workflows] crontab unavailable — leaving workflows.json untouched');
  process.exit(1);
}
entries.push(...parseCrontab(crontab, LOCAL_TZ));

const unitDir = join(homedir(), '.config/systemd/user');
for (const key of Object.keys(WORKFLOW_ALLOWLIST)) {
  if (!key.startsWith('systemd:')) continue;
  const unit = key.slice('systemd:'.length);
  const file = join(unitDir, unit);
  if (!existsSync(file)) continue;
  const e = parseSystemdTimer(unit, readFileSync(file, 'utf-8'), LOCAL_TZ);
  if (e) entries.push(e);
}

for (const [name, path] of Object.entries(GHA)) {
  const file = expandTilde(path);
  if (existsSync(file)) entries.push(...parseGithubSchedule(`gha:${name}`, readFileSync(file, 'utf-8')));
}

const data = buildWorkflows(entries, WORKFLOW_ALLOWLIST, WORKFLOW_GROUPS, new Date().toISOString());
const jobCount = data.groups.reduce((n, g) => n + g.jobs.length, 0);
if (jobCount === 0) {
  console.error('[refresh-workflows] no allowlisted jobs found — leaving workflows.json untouched');
  process.exit(1);
}

const outPath = resolve(ROOT, 'src/data/workflows.json');
// Keep the file stable when only the timestamp would change, so the nightly
// commit doesn't churn.
if (existsSync(outPath)) {
  const prev = JSON.parse(readFileSync(outPath, 'utf-8'));
  if (JSON.stringify(prev.groups) === JSON.stringify(data.groups)) {
    console.log(`[refresh-workflows] unchanged (${jobCount} jobs)`);
    process.exit(0);
  }
}
writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
console.log(`[refresh-workflows] wrote ${jobCount} jobs in ${data.groups.length} groups → ${outPath}`);

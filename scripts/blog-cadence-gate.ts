// Deterministic, code-enforced blog publish-cadence gate. Two posts must never publish less
// than min_gap_days apart — that rule used to be prose only, and prose doesn't stop a manual
// "owner override" session from publishing minutes after a watchdog post (2026-10-03 incident).
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { readFileSync } from 'node:fs';

export interface SeededPost {
  slug: string;
  publishedAt: string;
}

export interface SpacingViolation {
  earlier: string;
  later: string;
  gapHours: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function findSpacingViolations(
  posts: SeededPost[],
  minGapDays: number,
  sinceIso: string,
): SpacingViolation[] {
  const sinceMs = new Date(sinceIso).getTime();
  const sorted = [...posts].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  const violations: SpacingViolation[] = [];
  const minGapMs = minGapDays * MS_PER_DAY;

  for (let i = 1; i < sorted.length; i++) {
    const earlier = sorted[i - 1];
    const later = sorted[i];
    const laterMs = new Date(later.publishedAt).getTime();
    if (laterMs < sinceMs) continue;

    const gapMs = laterMs - new Date(earlier.publishedAt).getTime();
    if (gapMs < minGapMs) {
      violations.push({
        earlier: earlier.slug,
        later: later.slug,
        gapHours: gapMs / MS_PER_HOUR,
      });
    }
  }

  return violations;
}

export function nextAllowedSlot(posts: SeededPost[], minGapDays: number, now: Date): string {
  if (posts.length === 0) return now.toISOString();

  const latestMs = Math.max(...posts.map(p => new Date(p.publishedAt).getTime()));
  const earliestAllowedMs = latestMs + minGapDays * MS_PER_DAY;

  return new Date(Math.max(now.getTime(), earliestAllowedMs)).toISOString();
}

export async function loadSeededPosts(): Promise<SeededPost[]> {
  const savedEnv = {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    BILKO_SQLITE_PATH: process.env.BILKO_SQLITE_PATH,
  };

  const savedConsoleLog = console.log;

  try {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    const tmpDir = await mkdtemp(path.join(tmpdir(), 'blog-cadence-gate-'));
    process.env.BILKO_SQLITE_PATH = path.join(tmpDir, 'cadence-check.db');

    const { initDb, dbAll } = await import('../server/db.js');
    // initDb() logs "[DB] Initialized" to stdout; the CLI's stdout is the
    // single ISO line the watchdog parses, so route that log to stderr.
    console.log = console.error;
    try {
      await initDb();
    } finally {
      console.log = savedConsoleLog;
    }

    const rows = await dbAll<{ slug: string; published_at: string | null }>(
      'SELECT slug, published_at FROM blog_posts WHERE published = 1',
    );

    const posts: SeededPost[] = [];
    for (const row of rows) {
      if (!row.published_at) continue;
      const d = new Date(row.published_at);
      if (Number.isNaN(d.getTime())) continue;
      posts.push({ slug: row.slug, publishedAt: d.toISOString() });
    }

    return posts;
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

interface CadenceConfig {
  minGapDays: number;
  sinceIso: string;
}

function loadCadenceConfig(): CadenceConfig {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(scriptDir, '..', '.claude/skills/blog-from-git/blog.config.yaml');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    process.stderr.write(`blog-cadence-gate: cannot read ${configPath}: ${(err as Error).message}\n`);
    process.exit(1);
  }

  let doc: any;
  try {
    doc = yaml.load(raw);
  } catch (err) {
    process.stderr.write(`blog-cadence-gate: failed to parse ${configPath}: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const cadence = doc?.cadence;
  const minGapDays = cadence?.min_gap_days;
  const sinceIso = cadence?.min_gap_enforced_since;

  if (typeof minGapDays !== 'number' || typeof sinceIso !== 'string') {
    process.stderr.write(
      `blog-cadence-gate: blog.config.yaml cadence block is missing min_gap_days / min_gap_enforced_since\n`,
    );
    process.exit(1);
  }

  return { minGapDays, sinceIso };
}

async function runCheck(): Promise<void> {
  const { minGapDays, sinceIso } = loadCadenceConfig();
  const posts = await loadSeededPosts();
  const violations = findSpacingViolations(posts, minGapDays, sinceIso);

  if (violations.length === 0) {
    console.log('ok');
    return;
  }

  for (const v of violations) {
    console.log(`${v.earlier} -> ${v.later}: ${v.gapHours.toFixed(1)}h apart (min ${minGapDays * 24}h)`);
  }
  process.exit(1);
}

async function runNextSlot(): Promise<void> {
  const { minGapDays } = loadCadenceConfig();
  const posts = await loadSeededPosts();
  console.log(nextAllowedSlot(posts, minGapDays, new Date()));
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === 'check') {
    await runCheck();
  } else if (cmd === 'next-slot') {
    await runNextSlot();
  } else {
    process.stderr.write('Usage: blog-cadence-gate.ts <check|next-slot>\n');
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

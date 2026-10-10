import { createClient, type Client, type InStatement, type Transaction } from '@libsql/client';
import { MIGRATIONS, ADDITIVE_COLUMNS } from './db-schema.js';
import { loadBlogPosts } from './blog-posts.js';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BLOG_REWRITES, type BlogRewrite } from './blog-rewrites/index.js';
import { DEFAULT_BUDGET_GZ_BYTES, APP_BUDGETS_GZ_BYTES } from '../mcp-host-server/src/contract/app-budgets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (url) {
      _client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    } else {
      // Local dev — file-based SQLite via libsql
      const dbPath = process.env.BILKO_SQLITE_PATH ?? resolve(__dirname, '../data/contentgrade.db');
      mkdirSync(dirname(dbPath), { recursive: true });
      _client = createClient({ url: `file:${dbPath}` });
    }
  }
  return _client;
}

// ── Query helpers ───────────────────────────────────────────────────────────

type Executor = { execute(stmt: { sql: string; args: any[] }): Promise<any> };

async function execGet<T>(exec: Executor, sql: string, ...args: unknown[]): Promise<T | undefined> {
  const result = await exec.execute({ sql, args: args as any[] });
  if (result.rows.length === 0) return undefined;
  return result.rows[0] as unknown as T;
}

async function execAll<T>(exec: Executor, sql: string, ...args: unknown[]): Promise<T[]> {
  const result = await exec.execute({ sql, args: args as any[] });
  return result.rows as unknown as T[];
}

async function execRun(exec: Executor, sql: string, ...args: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> {
  const result = await exec.execute({ sql, args: args as any[] });
  return { changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid ?? 0) };
}

// Global-scoped helpers (use the singleton client)
export const dbGet = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => execGet<T>(getClient(), sql, ...args);
export const dbAll = <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => execAll<T>(getClient(), sql, ...args);
export const dbRun = (sql: string, ...args: unknown[]) => execRun(getClient(), sql, ...args);

// Transaction-scoped helpers (use a transaction object)
export const txGet = <T = Record<string, unknown>>(tx: Transaction, sql: string, ...args: unknown[]) => execGet<T>(tx, sql, ...args);
export const txRun = (tx: Transaction, sql: string, ...args: unknown[]) => execRun(tx, sql, ...args);

export async function dbTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await getClient().transaction('write');
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// ── Migration ───────────────────────────────────────────────────────────────


const REFERRER_RULES_SEED: ReadonlyArray<[string, string, string]> = [
  // pattern, bucket, source_name
  ['twitter.com', 'social', 'twitter'],
  ['x.com', 'social', 'twitter'],
  ['t.co', 'social', 'twitter'],
  ['linkedin.com', 'social', 'linkedin'],
  ['lnkd.in', 'social', 'linkedin'],
  ['reddit.com', 'social', 'reddit'],
  ['old.reddit.com', 'social', 'reddit'],
  ['news.ycombinator.com', 'social', 'hackernews'],
  ['producthunt.com', 'social', 'producthunt'],
  ['facebook.com', 'social', 'facebook'],
  ['fb.com', 'social', 'facebook'],
  ['instagram.com', 'social', 'instagram'],
  ['google.com', 'organic', 'google'],
  ['bing.com', 'organic', 'bing'],
  ['duckduckgo.com', 'organic', 'duckduckgo'],
  ['github.com', 'referral', 'github'],
  ['bilko.run', 'internal', 'internal'],
];

const SEEDS = [
  ['stripe.com', 62, 'C+', "Stripe's landing page is so comprehensive, it's practically a textbook — and just as exciting to read."],
  ['example.com', 15, 'F', "This page has the conversion power of a 'Please take one' sign at a dentist's office."],
  ['shopify.com', 78, 'B+', "Shopify's page sells the dream of entrepreneurship while burying the pricing like a prenup."],
  ['notion.so', 71, 'B', "Notion's landing page is clean, minimal, and about as urgent as a Sunday afternoon nap."],
  ['linear.app', 85, 'A', "Linear's site is so well-designed it makes you feel bad about your own product before you even sign up."],
  ['vercel.com', 74, 'B', "Vercel's hero section deploys faster than their actual deploys. The rest of the page is still loading."],
] as const;

/**
 * Runs `statements` at most once per database, keyed by `id` in
 * data_migrations. Use it to correct a seeded row that the owner can edit
 * afterwards (e.g. a blog post through routes/blog.ts): a guard on the row's
 * own content ("only while the note is missing") would put the correction
 * back on every deploy after the owner edits it out. The statements and the
 * marker commit in one batch, so a boot that fails midway retries all of it.
 * Two instances booting at once can both run the statements, so keep each one
 * safe to apply twice.
 */
async function applyDataMigrationOnce(id: string, statements: InStatement[], doneIds?: Set<string>): Promise<boolean> {
  if (doneIds) {
    if (doneIds.has(id)) return false;
  } else {
    const done = await dbGet<{ n: number }>('SELECT 1 AS n FROM data_migrations WHERE id = ?', id);
    if (done) return false;
  }
  await getClient().batch(
    [
      ...statements,
      { sql: 'INSERT OR IGNORE INTO data_migrations (id, applied_at) VALUES (?, ?)', args: [id, Math.floor(Date.now() / 1000)] },
    ],
    'write',
  );
  doneIds?.add(id);
  return true;
}

/** Ids of every data migration already applied: one round-trip instead of one per migration. */
async function loadDoneMigrationIds(): Promise<Set<string>> {
  const rows = await dbAll<{ id: string }>('SELECT id FROM data_migrations');
  return new Set(rows.map(r => r.id));
}

/**
 * Applies each rewrite's title/excerpt/content once per post, keyed by its own
 * migrationId. Never touches slug, published_at, category or published, so a
 * sibling PRD rewriting one post can't collide with another's.
 */
export async function applyBlogRewrites(rewrites: BlogRewrite[], doneIds?: Set<string>): Promise<void> {
  const done = doneIds ?? await loadDoneMigrationIds();
  for (const r of rewrites) {
    await applyDataMigrationOnce(r.migrationId, [
      {
        sql: 'UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, updated_at = ? WHERE slug = ?',
        args: [r.title, r.excerpt, r.content, new Date().toISOString(), r.slug],
      },
    ], done);
  }
}

export async function initDb(): Promise<void> {
  const client = getClient();

  // Run all migrations in a single batch (one network round-trip)
  await client.batch(MIGRATIONS.map(sql => ({ sql, args: [] })), 'write');

  // Additive column migrations for existing DBs: read each table's columns once and
  // ALTER only what is missing, so a steady-state boot issues no ALTER at all.
  for (const [table, columns] of Object.entries(ADDITIVE_COLUMNS)) {
    const existing = new Set((await client.execute(`PRAGMA table_info(${table})`)).rows.map(r => String(r.name)));
    if (existing.size === 0) continue;
    const missing = columns.filter(([name]) => !existing.has(name));
    if (missing.length === 0) continue;
    await client.batch(missing.map(([name, def]) => `ALTER TABLE ${table} ADD COLUMN ${name} ${def}`), 'write');
  }

  // The install beacon collects no PII at all — the anonymous install UUID is
  // the entire identity model — so identify_email can only ever hold NULL. Dropped
  // rather than left in place: a column that can only be NULL invites someone
  // to start filling it. No-ops on a DB that never had it.
  const installCols = (await client.execute('PRAGMA table_info(app_installs)')).rows.map(r => String(r.name));
  if (installCols.includes('identify_email')) {
    await client.execute('ALTER TABLE app_installs DROP COLUMN identify_email');
  }

  // Indexes (some cover the columns added above), one batch.
  await client.batch([
    'CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_source_bucket ON page_views(source_bucket)',
    'CREATE INDEX IF NOT EXISTS idx_funnel_events_tool ON funnel_events(tool)',
    'CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON funnel_events(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_funnel_events_tool_version ON funnel_events(tool, version)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_email ON page_views(email)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email)',
    'CREATE INDEX IF NOT EXISTS idx_token_transactions_reason ON token_transactions(reason)',
    'CREATE INDEX IF NOT EXISTS idx_stripe_one_time_purchases_created ON stripe_one_time_purchases(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_project_feedback_moderated ON project_feedback (slug, moderation_at)',
    'CREATE INDEX IF NOT EXISTS idx_project_feedback_status ON project_feedback (slug, status_at)',
  ], 'write');

  // Idempotent seeds, all sent as batched writes instead of one round-trip each.
  const nowSec = Math.floor(Date.now() / 1000);
  const seedStatements: InStatement[] = [];

  for (const [pattern, bucket, source] of REFERRER_RULES_SEED) {
    seedStatements.push({
      sql: 'INSERT OR IGNORE INTO referrer_rules (host_pattern, bucket, source_name) VALUES (?, ?, ?)',
      args: [pattern, bucket, source],
    });
  }

  // app_budgets with default 200 KB gz budget for every static-path sibling
  const STATIC_SLUGS = [
    'game-academy', 'outdoor-hours', 'local-score', 'stepproof', 'stack-audit',
    'git-viewer', 'launch-grader', 'ad-scorer', 'headline-grader', 'thread-grader',
    'email-forge', 'audience-decoder', 'page-roast', 'social-signals-trader',
  ];
  for (const slug of STATIC_SLUGS) {
    seedStatements.push({
      sql: 'INSERT OR IGNORE INTO app_budgets (slug, max_size_gz_bytes, updated_at) VALUES (?, ?, ?)',
      args: [slug, DEFAULT_BUDGET_GZ_BYTES, nowSec],
    });
  }

  // Apps with a per-slug override in the budget contract (mcp-host-server/src/contract/app-budgets.ts),
  // e.g. academy's cl100k_base BPE table or escape-velocity's Godot wasm export. These use a
  // raise-if-lower upsert, not INSERT OR IGNORE: an existing row that is BELOW the real bundle
  // size makes the publish gate unpassable forever, which is exactly what happened to
  // session-manager (budget 195 KB vs an already-live 1,072,016-byte bundle — the live bundle
  // predates the budget row, so the gate could only ever block updates to a bundle it had
  // already shipped). Raise-only: a budget that has been deliberately tightened below these
  // defaults is left alone only if it is already above them.
  for (const [slug, limit] of Object.entries(APP_BUDGETS_GZ_BYTES)) {
    seedStatements.push({
      sql: 'INSERT INTO app_budgets (slug, max_size_gz_bytes, updated_at) VALUES (?, ?, ?) '
         + 'ON CONFLICT(slug) DO UPDATE SET max_size_gz_bytes = ?, updated_at = ? '
         + 'WHERE app_budgets.max_size_gz_bytes < ?',
      args: [slug, limit, nowSec, limit, nowSec, limit],
    });
  }

  // app_spend_ceilings for all paid tools. Academy gets a tighter ceiling:
  // 5 calls/user × expected daily active users.
  const PAID_TOOL_SLUGS = [
    'stack-audit', 'launch-grader', 'page-roast',
    'ad-scorer', 'headline-grader', 'thread-grader',
    'email-forge', 'audience-decoder',
  ];
  const CEILINGS: Array<[string, number]> = [['academy', 200], ...PAID_TOOL_SLUGS.map((slug): [string, number] => [slug, 2000])];
  for (const [slug, max] of CEILINGS) {
    seedStatements.push({
      sql: 'INSERT OR IGNORE INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)',
      args: [slug, max, nowSec],
    });
  }

  // secret_metadata (NULL last_rotated_at = never rotated)
  const SECRET_NAMES = [
    'STRIPE_API_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'GEMINI_API_KEY',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'TURSO_AUTH_TOKEN',
  ];
  for (const name of SECRET_NAMES) {
    seedStatements.push({
      sql: 'INSERT OR IGNORE INTO secret_metadata (name, last_rotated_at, notes, created_at) VALUES (?, NULL, ?, ?)',
      args: [name, 'seeded on PRD 29', nowSec],
    });
  }

  // Blog posts from content/blog/*.md (one file per post, ordered by frontmatter).
  // INSERT OR IGNORE never touches a row production already has; the one-shot
  // data migrations below carry corrections to existing rows.
  const seedPosts = loadBlogPosts();
  for (const p of seedPosts) {
    seedStatements.push({
      sql: `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [p.slug, p.title, p.excerpt, p.content, p.category, p.published ? 1 : 0, p.published_at],
    });
  }
  for (let i = 0; i < seedStatements.length; i += 50) {
    await client.batch(seedStatements.slice(i, i + 50), 'write');
  }

  // Seed Wall of Shame with sample roasts (only if empty)
  const count = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history');
  if (!count || count.n === 0) {
    await client.batch(
      SEEDS.map(([url, score, grade, roast]) => ({
        sql: 'INSERT INTO roast_history (url, score, grade, roast) VALUES (?, ?, ?, ?)',
        args: [url, score, grade, roast],
      })),
      'write',
    );
  }

  // The Field Manual went free on 2026-09-25 (release 2.0.1). This dated post
  // keeps its slug and its August story, but it must not read as a live $19.99
  // offer anywhere it appears: the /blog index and the share text show the
  // title, and the post page shows the excerpt above the body. So the title
  // says "Was", the excerpt ends on the change, and the body opens with a
  // dated note. A fresh database gets all three from this seed. INSERT OR
  // IGNORE never touches the row production already has, so the one-shot
  // data migration below rewrites that row once, and never again: an edit
  // the owner makes later through the blog admin sticks.
  const doneIds = await loadDoneMigrationIds();
  const MANUAL_FREE_SLUG = 'the-app-stays-free-the-manual-is-19-99';
  const MANUAL_FREE_TITLE = 'The App Stays Free, The Manual Was $19.99 (Now Free)';
  const MANUAL_FREE_EXCERPT =
    `Session Manager's marketing page said "Buy Now — $19.99" under the app itself, implying the free, MIT-licensed tool was the paid product. It wasn't — and since 2026-09-25 the manual is free too.`;
  const MANUAL_FREE_NOTE =
    `**Update, 2026-09-25:** the Field Manual is now free — every chapter, plus the PDF and offline editions, with no sign-in needed, at bilko.run/products/session-manager/manual. The app is still free too. What follows is the August story.\n\n`;
  await applyDataMigrationOnce('2026-09-25-blog-manual-now-free', [
    {
      sql: 'UPDATE blog_posts SET title = ?, excerpt = ?, updated_at = ? WHERE slug = ?',
      args: [MANUAL_FREE_TITLE, MANUAL_FREE_EXCERPT, new Date().toISOString(), MANUAL_FREE_SLUG],
    },
    {
      // Guarded so a fresh seed (or a second instance booting alongside this
      // one) never gets the note twice.
      sql: 'UPDATE blog_posts SET content = ? || content WHERE slug = ? AND content NOT LIKE ?',
      args: [MANUAL_FREE_NOTE, MANUAL_FREE_SLUG, '**Update, 2026-09-25:%'],
    },
  ], doneIds);

  // Owner feedback 2026-10-03: this post's links must be full, clickable URLs
  // (the audience is early college students clicking straight through), and
  // "the project is open source" must actually link the repo. INSERT OR
  // IGNORE never touches a row production already has, so the one-shot data
  // migration below (which also fixes every other live post's site-relative
  // markdown links) carries this correction to production once.
  const GIT_VIEWER_SLUG = 'turn-your-github-year-into-a-heatmap-and-badge-wall';
  const GIT_VIEWER_CONTENT = seedPosts.find(p => p.slug === GIT_VIEWER_SLUG)!.content;
  await applyDataMigrationOnce('2026-10-03-blog-absolute-links', [
    {
      sql: 'UPDATE blog_posts SET content = ?, updated_at = ? WHERE slug = ?',
      args: [GIT_VIEWER_CONTENT, new Date().toISOString(), GIT_VIEWER_SLUG],
    },
    {
      // Every other live post's site-relative markdown links (`](/...`)
      // become absolute bilko.run URLs. Links that are already absolute
      // don't match '](/' (the next char is a scheme letter, not '/'), and
      // a protocol-relative '](//host/...' link would — there are none in
      // the seed data today (see tests/db.test.ts), so this is safe as written.
      sql: "UPDATE blog_posts SET content = REPLACE(content, '](/', '](https://bilko.run/') WHERE content LIKE '%](/%'",
      args: [],
    },
  ], doneIds);

  // One-shot fix for prod rows already seeded with the same-day timestamp
  // before this reschedule landed. WHERE pins both slug and the OLD
  // published_at so an owner edit to a different date is never clobbered.
  await applyDataMigrationOnce('2026-10-03-reschedule-outdoor-hours-post', [
    {
      sql: 'UPDATE blog_posts SET published_at = ?, updated_at = ? WHERE slug = ? AND published_at = ?',
      args: [
        '2026-10-07T16:00:00.000Z',
        new Date().toISOString(),
        'twelve-places-one-weather-rule-you-set-yourself',
        '2026-10-03T17:26:18.000Z',
      ],
    },
  ], doneIds);

  // ContentGrade is retired: drop it from two seeded posts. The exact old
  // sentence is replaced, so an owner edit elsewhere in the post survives.
  const dropContentGrade: Array<[string, string, string]> = [
    [
      'from-saas-to-host-decomposing-bilko-in-one-week',
      "The MCP commits to the host's `origin` and `content-grade` remotes in parallel — failure on one doesn't block the other — and Render auto-deploys within a minute.",
      "The MCP commits to the host repo's `origin` remote, and Render auto-deploys within a minute.",
    ],
    [
      'week-of-six-games',
      'Render auto-deploys from `Content-Grade/master`, not `main`, and the webhook',
      'Render was auto-deploying from a different branch than we assumed, and the webhook',
    ],
  ];
  await applyDataMigrationOnce(
    '2026-10-09-blog-drop-content-grade',
    dropContentGrade.map(([slug, oldText, newText]) => ({
      sql: 'UPDATE blog_posts SET content = replace(content, ?, ?), updated_at = ? WHERE slug = ?',
      args: [oldText, newText, new Date().toISOString(), slug],
    })),
    doneIds,
  );

  await applyBlogRewrites(BLOG_REWRITES, doneIds);

  console.log('[DB] Initialized' + (process.env.TURSO_DATABASE_URL ? ' (Turso)' : ' (local SQLite)'));
}

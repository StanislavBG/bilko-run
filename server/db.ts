import { createClient, type Client, type Transaction } from '@libsql/client';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (url) {
      _client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    } else {
      // Local dev — file-based SQLite via libsql
      mkdirSync(resolve(__dirname, '../data'), { recursive: true });
      const dbPath = resolve(__dirname, '../data/contentgrade.db');
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

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS usage_tracking (
    id INTEGER PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ip_hash, endpoint, date)
  )`,
  `CREATE TABLE IF NOT EXISTS email_captures (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    tool TEXT NOT NULL,
    score TEXT NOT NULL DEFAULT '',
    ip_hash TEXT,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stripe_customers (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    plan_tier TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stripe_one_time_purchases (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT NOT NULL UNIQUE,
    product_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS license_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    stripe_customer_id TEXT,
    product_key TEXT NOT NULL DEFAULT 'contentgrade_pro',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_validated_at DATETIME,
    validation_count INTEGER DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key)`,
  `CREATE INDEX IF NOT EXISTS idx_license_keys_email ON license_keys(email)`,
  `CREATE TABLE IF NOT EXISTS token_balances (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS token_transactions (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_token_balances_email ON token_balances(email)`,
  `CREATE INDEX IF NOT EXISTS idx_token_transactions_email ON token_transactions(email)`,
  `CREATE TABLE IF NOT EXISTS social_roast_rivals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_a TEXT NOT NULL,
    url_a TEXT NOT NULL,
    x_handle_a TEXT,
    name_b TEXT NOT NULL,
    url_b TEXT NOT NULL,
    x_handle_b TEXT,
    category TEXT,
    location TEXT,
    last_roasted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS roast_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    score INTEGER NOT NULL,
    grade TEXT NOT NULL,
    roast TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS user_roasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    url TEXT NOT NULL,
    score INTEGER NOT NULL,
    grade TEXT NOT NULL,
    roast TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_roasts_email ON user_roasts(email)`,
  `CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    referrer TEXT,
    country TEXT,
    ua TEXT,
    screen TEXT,
    email TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(date)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path)`,
  `CREATE TABLE IF NOT EXISTS social_roast_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rival_pair_id INTEGER REFERENCES social_roast_rivals(id),
    platform TEXT DEFAULT 'x',
    post_text TEXT NOT NULL,
    score_a INTEGER,
    score_b INTEGER,
    winner TEXT,
    roast_a TEXT,
    roast_b TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_for TEXT,
    posted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'build-log',
    cover_image TEXT,
    published INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published)`,
  `CREATE TABLE IF NOT EXISTS funnel_events (
    id INTEGER PRIMARY KEY,
    event TEXT NOT NULL,
    ip_hash TEXT,
    tool TEXT,
    email TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_funnel_events_event ON funnel_events(event)`,
  `CREATE INDEX IF NOT EXISTS idx_funnel_events_created ON funnel_events(created_at)`,
  `CREATE TABLE IF NOT EXISTS referrer_rules (
    host_pattern TEXT PRIMARY KEY,
    bucket TEXT NOT NULL,
    source_name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    landing_path TEXT,
    exit_path TEXT,
    page_count INTEGER DEFAULT 1,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    source_bucket TEXT,
    referrer_host TEXT,
    country TEXT,
    device TEXT,
    email TEXT,
    converted INTEGER DEFAULT 0,
    purchased INTEGER DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at)`,
  `CREATE TABLE IF NOT EXISTS app_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    app           TEXT NOT NULL,
    version       TEXT,
    level         TEXT NOT NULL CHECK (level IN ('info','warn','error')),
    msg           TEXT NOT NULL,
    visitor_id    TEXT,
    session_id    TEXT,
    fields_json   TEXT,
    created_at    INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_app_logs_app_created ON app_logs (app, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs (level, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS app_errors (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    app           TEXT NOT NULL,
    version       TEXT,
    name          TEXT,
    msg           TEXT NOT NULL,
    stack         TEXT,
    url           TEXT,
    ua            TEXT,
    visitor_id    TEXT,
    session_id    TEXT,
    context_json  TEXT,
    created_at    INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_app_errors_app_created ON app_errors (app, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS app_manifests (
    slug             TEXT PRIMARY KEY,
    schema_version   INTEGER NOT NULL,
    app_version      TEXT NOT NULL,
    built_at         TEXT NOT NULL,
    git_sha          TEXT NOT NULL,
    git_branch       TEXT NOT NULL,
    host_kit_version TEXT NOT NULL,
    golden_path      TEXT NOT NULL,
    golden_expect    TEXT NOT NULL DEFAULT '',
    health_path      TEXT,
    bundle_size_gz   INTEGER NOT NULL,
    bundle_files     INTEGER NOT NULL,
    manifest_json    TEXT NOT NULL,
    updated_at       INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS synthetic_runs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL,
    ok            INTEGER NOT NULL,
    http_status   INTEGER,
    load_ms       INTEGER,
    expect_found  INTEGER,
    error_msg     TEXT,
    ran_at        INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_synthetic_runs_slug_ran ON synthetic_runs (slug, ran_at DESC)`,
  `CREATE TABLE IF NOT EXISTS synthetic_alerts (
    slug             TEXT PRIMARY KEY,
    first_failed_at  INTEGER NOT NULL,
    notified_at      INTEGER,
    resolved_at      INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS app_budgets (
    slug              TEXT PRIMARY KEY,
    max_size_gz_bytes INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS publish_overrides (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL,
    gate         TEXT NOT NULL,
    reason       TEXT,
    admin_email  TEXT,
    created_at   INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_publish_overrides_slug ON publish_overrides (slug, created_at DESC)`,
  // User-submitted feedback from a sibling app's in-page widget. Public write,
  // authed read — see server/routes/project-feedback.ts. `description` is
  // untrusted user text stored raw; escape it wherever it is rendered.
  `CREATE TABLE IF NOT EXISTS project_feedback (
    id                    TEXT PRIMARY KEY,
    slug                  TEXT NOT NULL,
    target_kind           TEXT NOT NULL,
    target_id             TEXT NOT NULL,
    target_label          TEXT,
    route                 TEXT,
    type                  TEXT NOT NULL,
    title                 TEXT NOT NULL,
    description           TEXT NOT NULL,
    image_mime            TEXT,
    image_data            TEXT,
    client_json           TEXT,
    snapshot_generated_at TEXT,
    created_at            INTEGER NOT NULL,
    parent_id             TEXT,
    moderation_action     TEXT,
    moderation_at         INTEGER,
    moderation_reason     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_project_feedback_slug_created ON project_feedback (slug, created_at)`,
  // Per-route API response bytes, bucketed by day. Keyed on the route PATTERN
  // (`/api/projects/:slug/feedback`), not the resolved URL, so cardinality is
  // bounded by the number of routes. See server/egress.ts.
  `CREATE TABLE IF NOT EXISTS api_egress_daily (
    date     TEXT NOT NULL,
    method   TEXT NOT NULL,
    route    TEXT NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    bytes    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, method, route)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_api_egress_daily_date ON api_egress_daily (date)`,
  // Per-asset static egress, bucketed by exact URL — the per-file sibling of
  // api_egress_daily's static:<slug> rollup. Bounded to at most 51 rows per
  // (date, slug): top 50 paths by bytes, plus one folded-in '_rest' row for
  // everything past the top 50. Pruned back to that bound on every flush —
  // see egress.ts's pruneAssetOverflow(). Answers "which FILE burned the
  // bytes", not just "which project".
  `CREATE TABLE IF NOT EXISTS static_asset_daily (
    date     TEXT NOT NULL,
    slug     TEXT NOT NULL,
    path     TEXT NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    bytes    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, slug, path)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_static_asset_daily_date_slug ON static_asset_daily (date, slug)`,
  `CREATE TABLE IF NOT EXISTS usage_daily (
    user_email   TEXT NOT NULL,
    app_slug     TEXT NOT NULL,
    date         TEXT NOT NULL,
    calls        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_email, app_slug, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_usage_daily_app_date ON usage_daily (app_slug, date)`,
  `CREATE TABLE IF NOT EXISTS app_spend_ceilings (
    app_slug          TEXT PRIMARY KEY,
    max_calls_per_day INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cost_alerts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_kind   TEXT NOT NULL,
    app_slug     TEXT,
    user_email   TEXT,
    details_json TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    resolved_at  INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cost_alerts_open ON cost_alerts (resolved_at, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS csp_violations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    blocked_uri   TEXT,
    violated_dir  TEXT,
    document_uri  TEXT,
    source_file   TEXT,
    line_number   INTEGER,
    user_agent    TEXT,
    created_at    INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_csp_violations_created ON csp_violations (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS secret_metadata (
    name             TEXT PRIMARY KEY,
    last_rotated_at  INTEGER,
    rotated_by       TEXT,
    notes            TEXT,
    created_at       INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_scores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    game         TEXT NOT NULL,
    user_email   TEXT NOT NULL,
    score        REAL NOT NULL,
    mode         TEXT NOT NULL DEFAULT '',
    payload_json TEXT,
    created_at   INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scores_game_score ON game_scores (game, mode, score DESC, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_scores_user ON game_scores (user_email, game)`,
  `CREATE TABLE IF NOT EXISTS game_saves (
    game        TEXT NOT NULL,
    user_email  TEXT NOT NULL,
    blob_json   TEXT NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (game, user_email)
  )`,
  `CREATE TABLE IF NOT EXISTS game_achievements (
    game         TEXT NOT NULL,
    user_email   TEXT NOT NULL,
    key          TEXT NOT NULL,
    unlocked_at  INTEGER NOT NULL,
    PRIMARY KEY (game, user_email, key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_achievements_user ON game_achievements (user_email)`,
  `CREATE TABLE IF NOT EXISTS academy_quota_daily (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email_hash TEXT NOT NULL,
    call_at    INTEGER NOT NULL,
    outcome    TEXT NOT NULL CHECK (outcome IN ('ok','error','denied','rate_limited')),
    token_in   INTEGER NOT NULL DEFAULT 0,
    token_out  INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS academy_quota_email_at ON academy_quota_daily(email_hash, call_at)`,
  // Per-project live data snapshot (see server/routes/project-data.ts). One row
  // per sibling app slug; payload is the app's JSON snapshot, replaced in place
  // by the publisher so the live page can fetch fresh data without a git commit.
  `CREATE TABLE IF NOT EXISTS project_snapshots (
    slug       TEXT PRIMARY KEY,
    payload    TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  // Per-project live EVENT STREAM (see server/routes/project-events.ts) — the
  // append-only sibling of project_snapshots above. A sibling app's dashboard
  // polls a Range-capable ndjson file for appended rows (byte-cursor polling,
  // not a poll-whole-file refetch); this table is the durable, Render-redeploy
  // -safe backing store the GET route serves that same byte-Range contract
  // from, since the app's own filesystem is ephemeral and git-mirroring one
  // file per event is the 30-min bot-commit loop this replaced.
  `CREATE TABLE IF NOT EXISTS project_events (
    slug       TEXT NOT NULL,
    event_id   INTEGER NOT NULL,
    line       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (slug, event_id)
  )`,
];

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

export async function initDb(): Promise<void> {
  const client = getClient();

  // Run all migrations in a single batch (one network round-trip)
  await client.batch(MIGRATIONS.map(sql => ({ sql, args: [] })), 'write');

  // Additive migrations for existing DBs (safe to re-run)
  for (const sql of [
    'ALTER TABLE page_views ADD COLUMN email TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_source TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_medium TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_campaign TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_term TEXT',
    'ALTER TABLE page_views ADD COLUMN utm_content TEXT',
    'ALTER TABLE page_views ADD COLUMN visitor_id TEXT',
    'ALTER TABLE page_views ADD COLUMN session_id TEXT',
    'ALTER TABLE page_views ADD COLUMN is_new_visitor INTEGER DEFAULT 0',
    'ALTER TABLE page_views ADD COLUMN referrer_host TEXT',
    'ALTER TABLE page_views ADD COLUMN source_bucket TEXT',
    'ALTER TABLE page_views ADD COLUMN device TEXT',
    'ALTER TABLE page_views ADD COLUMN browser TEXT',
    'ALTER TABLE page_views ADD COLUMN os TEXT',
    'ALTER TABLE page_views ADD COLUMN is_bot INTEGER DEFAULT 0',
    'ALTER TABLE page_views ADD COLUMN is_admin INTEGER DEFAULT 0',
    'ALTER TABLE page_views ADD COLUMN created_at_ms INTEGER',
    'CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_source_bucket ON page_views(source_bucket)',
    'ALTER TABLE funnel_events ADD COLUMN session_id TEXT',
    'ALTER TABLE funnel_events ADD COLUMN visitor_id TEXT',
    'ALTER TABLE funnel_events ADD COLUMN path TEXT',
    'CREATE INDEX IF NOT EXISTS idx_funnel_events_tool ON funnel_events(tool)',
    'CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON funnel_events(session_id)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_email ON page_views(email)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email)',
    'CREATE INDEX IF NOT EXISTS idx_token_transactions_reason ON token_transactions(reason)',
    'CREATE INDEX IF NOT EXISTS idx_stripe_one_time_purchases_created ON stripe_one_time_purchases(created_at)',
    // Threading + moderation for the per-project feedback forum (see
    // server/routes/project-feedback.ts). parent_id is client-supplied and
    // opaque to this server; moderation_* is owner-only state set by the
    // authed moderate route.
    'ALTER TABLE project_feedback ADD COLUMN parent_id TEXT',
    'ALTER TABLE project_feedback ADD COLUMN moderation_action TEXT',
    'ALTER TABLE project_feedback ADD COLUMN moderation_at INTEGER',
    'ALTER TABLE project_feedback ADD COLUMN moderation_reason TEXT',
    'CREATE INDEX IF NOT EXISTS idx_project_feedback_moderated ON project_feedback (slug, moderation_at)',
  ]) {
    try { await client.execute(sql); } catch { /* column/index already exists */ }
  }

  // Seed referrer_rules (idempotent)
  for (const [pattern, bucket, source] of REFERRER_RULES_SEED) {
    try {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO referrer_rules (host_pattern, bucket, source_name) VALUES (?, ?, ?)',
        args: [pattern, bucket, source],
      });
    } catch { /* ignore */ }
  }

  // Seed app_budgets with default 200 KB gz budget for every static-path sibling (idempotent)
  const STATIC_SLUGS = [
    'game-academy', 'outdoor-hours', 'local-score', 'stepproof', 'stack-audit',
    'git-viewer', 'launch-grader', 'ad-scorer', 'headline-grader', 'thread-grader',
    'email-forge', 'audience-decoder', 'page-roast', 'social-signals-trader',
  ];
  for (const slug of STATIC_SLUGS) {
    try {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO app_budgets (slug, max_size_gz_bytes, updated_at) VALUES (?, ?, ?)',
        args: [slug, 200_000, Math.floor(Date.now() / 1000)],
      });
    } catch { /* ignore */ }
  }

  // Academy ships the cl100k_base BPE table for the in-browser tokenizer demo (~500 KB gz alone).
  // Bumped from default 200 KB to 700 KB; trim target tracked in Bilko-Academy/KNOWN-ISSUES.md.
  try {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO app_budgets (slug, max_size_gz_bytes, updated_at) VALUES (?, ?, ?)',
      args: ['academy', 700_000, Math.floor(Date.now() / 1000)],
    });
  } catch { /* ignore */ }

  // Seed app_spend_ceilings for all paid tools (idempotent)
  const PAID_TOOL_SLUGS = [
    'stack-audit', 'launch-grader', 'page-roast',
    'ad-scorer', 'headline-grader', 'thread-grader',
    'email-forge', 'audience-decoder',
  ];
  // Academy gets a tighter ceiling: 5 calls/user × expected daily active users
  try {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)',
      args: ['academy', 200, Math.floor(Date.now() / 1000)],
    });
  } catch { /* ignore */ }
  for (const slug of PAID_TOOL_SLUGS) {
    try {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)',
        args: [slug, 2000, Math.floor(Date.now() / 1000)],
      });
    } catch { /* ignore */ }
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

  // Seed first blog post
  const blogCount = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM blog_posts');
  if (!blogCount || blogCount.n === 0) {
    await dbRun(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      'how-pageroast-went-from-frustration-to-product',
      'How PageRoast Went From "I Need Feedback" to a Product That Roasts Landing Pages for Fun',
      'The story of building PageRoast — from launching to zero signups, learning CRO the hard way, and turning frustration into a tool that scores landing pages and delivers savage one-liners.',
      `## The launch that went nowhere

I launched my first product to zero signups. The code worked. The design was decent. The product did what it said it would do. But nobody signed up.

The problem wasn't the product. It was the page selling it.

I didn't know that at the time. I thought "clear" meant the same as "clever." I thought one testimonial from a friend counted as social proof. I thought hiding the price tag made me seem premium. I was wrong about all of it.

## Learning CRO the hard way

Over the next few months, I studied conversion rate optimization — not the theory, the actual frameworks that people use to audit landing pages. Joanna Wiebe on conversion copywriting. Peep Laja on evidence-based design. Harry Dry on marketing examples.

The patterns were obvious once I saw them:

- **Hero section**: Can someone understand what you do in 5 seconds? If your headline needs a subheadline to make sense, the headline isn't working.
- **Social proof**: Real testimonials with full names, photos, and company logos. Not "J." from "a company" saying "great product."
- **Clarity**: Benefits over features. "Save 10 hours/week" beats "AI-powered automation."
- **Conversion architecture**: One CTA above the fold. Not three competing buttons asking for different things.

Most landing pages fail at least two of these. Mine failed all four.

## The tool I wished existed

I wanted a tool that would read my actual page — not a template, not a checklist — and tell me specifically what was broken. Something that applied real frameworks, not just word counts or SEO scores.

That tool didn't exist. So I built it.

## How PageRoast works

PageRoast takes any URL, fetches the page content, and sends it through **Gemini 2.0 Flash** with a carefully calibrated scoring system:

- **Hero Section (25 pts)**: Headline clarity, subheadline specificity, CTA visibility, visual hierarchy
- **Social Proof (25 pts)**: Testimonials with names/photos, trust logos, quantified proof, risk reversal
- **Clarity & Persuasion (25 pts)**: 5-second test, benefits vs features, readability, objection handling
- **Conversion Architecture (25 pts)**: CTA clarity, urgency/scarcity, risk reversal, friction reduction

Each section gets scored independently. You get a total out of 100, a letter grade, section-by-section feedback with specific fixes, and — the part people actually share — a savage one-liner roast.

## The roast was an accident

The roast line wasn't in the original plan. I added it as a debugging artifact — a quick summary to validate the AI understood the page. But when I showed the tool to friends, they screenshotted the roast and shared it. Nobody screenshotted the score breakdown.

That's when I realized: **the roast is marketing. The score is the product.**

People come for the entertainment. They stay for the actionable fixes. And they share the one-liner, which brings more people. It's a viral loop that doesn't feel like marketing because it's genuinely funny.

## What I'd do differently

I'd ship sooner. The first version was embarrassing — rough UI, imprecise scoring, roast lines that weren't funny enough. I delayed three weeks polishing. Those three weeks taught me nothing that user feedback didn't teach in three days.

I'd also charge from day one. Free users gave zero feedback. Paid users told me exactly what was wrong.

## What's next

PageRoast is one of 7 tools on [bilko.run](/projects). Each one takes something that used to require a specialist and makes it available in 30 seconds through AI.

- [HeadlineGrader](/projects/headline-grader) scores headlines against 4 proven copywriting frameworks
- [AdScorer](/projects/ad-scorer) grades ad copy for Facebook, Google, and LinkedIn
- [ThreadGrader](/projects/thread-grader) analyzes X/Twitter threads for viral potential
- [EmailForge](/projects/email-forge) generates 5-email sequences using proven persuasion frameworks
- [AudienceDecoder](/projects/audience-decoder) identifies who actually follows you

Try [PageRoast](/projects/page-roast) — your first roast is free. Just don't blame me when the score hurts.

## FAQ

**Is PageRoast actually useful or just a joke?**
Both. The roast line is entertainment. The 4-section breakdown with specific fixes is real CRO analysis. Founders use it to improve their pages, then share the roast for clout.

**How accurate is the scoring?**
It's calibrated against reference examples — a "Tips for Better Marketing" headline scores below 35, while a data-rich headline with proof elements scores 85+. The AI uses the full 0-100 range, not the compressed 50-80 that most AI tools default to.

**What does it cost?**
First roast is free. After that, $1 per credit or $5 for 7. Same credits work across all bilko.run tools. No subscriptions.`,
      'product',
      new Date().toISOString(),
    );
  }

  // Seed StackAudit blog post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'we-built-stackaudit-because-reddit-told-us-to',
    'We Built StackAudit Because Reddit Told Us To',
    'How a single Reddit thread with 461 upvotes and 283 comments convinced us to build a SaaS cost-cutting tool — and what we learned about research-driven product development.',
    `## The thread that started it all

"The SaaS model is quietly falling apart for small businesses and nobody in tech wants to admit it."

That's the title of a Reddit post on r/Entrepreneur that got 461 upvotes and 283 comments. The post described a 12-person company paying for 23 separate SaaS subscriptions — and the total monthly bill was startling.

But the real gold was in the replies.

## What the comments revealed

One reply said: "We cut nine subscriptions in a single afternoon and nobody noticed." Nine tools. Gone. Zero impact on productivity. That's not optimization — that's waste discovery.

Another founder shared: "We emailed 50 churned customers offering to buy them coffee and talk about why they left." The most common answer? Too many tools, too much overlap, too little clarity on what each one actually did.

A third thread — "Built our SaaS on AWS. Monthly bill: $2,400. Moved to Hetzner. Monthly bill: $180" — showed the same pattern at the infrastructure level. Not a complex migration. Just switching from an enterprise platform to one that matched their actual needs.

## The gap we found

Enterprise stack audit tools exist. Zylo, Zluri, Torii — they cost $10,000-50,000 per year and require IT integration. They're built for companies with 305+ SaaS applications and dedicated procurement teams.

Nobody was serving the 1-20 person team with 15-30 tools who just needed a quick answer: "What am I wasting money on?"

## What we built

[StackAudit](/projects/stack-audit) lets you paste your tool list and get an AI analysis in 30 seconds:

- **Cost efficiency**: Are you overpaying? Are there free alternatives?
- **Tool overlap**: Are multiple tools doing the same job?
- **Self-host potential**: Could you run it yourself for less?
- **Stack complexity**: Is your stack right-sized for your team?
- **Future risk**: Are you locked into vendors with rising prices?

Each tool gets a KEEP, SWITCH, or CUT recommendation with a specific alternative suggestion.

## The numbers

The average small team wastes $200-500 per month on tools they don't use or could replace. That's $2,400-6,000 per year — enough to fund a contractor, a marketing campaign, or six months of better hosting.

Enterprise audit tools would charge you $10,000+ to find that waste. StackAudit costs $1.

## What we learned about research-driven development

This product didn't come from a brainstorm. It came from reading 3,690 Reddit posts that our automation system had captured and indexed in a vector database. We didn't guess what people needed — we searched for corroborated pain points across multiple threads and validated them against market data.

The lesson: **your users are already describing their problems publicly. You just need a system to find and synthesize those signals.**

## Try it

[StackAudit](/projects/stack-audit) is live. Paste your tools, see what you can save. Then [roast your landing page](/projects/page-roast) while you're at it.

## FAQ

**How accurate are the savings estimates?**
They're directional, not exact. Use them as a starting point for your own audit, not a final decision.

**Will it tell me to cancel everything?**
No. Some tools are worth every penny. We flag what's wasteful, redundant, or has a better alternative.

**How is this different from Zylo or Zluri?**
They cost $10K+/year, require IT integration, and target enterprises with 300+ apps. StackAudit costs $1, runs in 30 seconds, and is built for small teams.`,
    'product',
    new Date().toISOString(),
  );

  // Seed LocalScore blog post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'localscore-browser-ai-that-never-sees-your-data',
    'LocalScore: The AI Tool That Never Sees Your Data',
    'We built a document analyzer that runs entirely in your browser. No server, no API, no data transmission. Here\'s why browser-based AI is the future of privacy-sensitive tools.',
    `## The privacy problem with AI tools

Every time you paste a document into ChatGPT, Claude, or any cloud AI tool, that document travels across the internet to someone else's server. For most content, that's fine. For contracts, financial statements, HR documents, or medical records, it's a compliance nightmare.

GDPR fines have hit €5.88 billion cumulatively. The EU AI Act adds penalties up to €35 million or 7% of global turnover. Companies are scared — and they should be.

But the alternative (not using AI at all) means missing out on the single biggest productivity leap of the decade.

## What if the AI ran on YOUR device?

That's the idea behind [LocalScore](/projects/local-score). The AI model downloads to your browser and runs on your device's GPU. Your document is processed locally. Nothing is uploaded. Nothing is transmitted. Nothing is stored on any server.

This isn't a theoretical architecture. It works today, in production, in Chrome.

## How Google Gemma made this possible

On April 2, 2026, Google released Gemma 4 — a family of open-weight models designed for edge and browser deployment. The E2B (Effective 2B) model runs at 40-180 tokens per second in a browser tab via WebGPU.

Key specs that make browser AI viable:
- **3.2GB** at 4-bit quantization (downloads once, cached in IndexedDB)
- **128K context window** — can process entire contracts
- **Apache 2.0 license** — free for commercial use
- **WebGPU acceleration** — uses your GPU, not your CPU

Combined with WebLLM (an open-source browser inference engine), we can run Gemma at near-native speed inside a Chrome tab.

## What LocalScore does

Four analysis modes, all running locally:

1. **Contract Review**: Extract key terms, obligations, risks, unusual clauses, deadlines
2. **Financial Summary**: Identify key numbers, trends, risks, action items
3. **Meeting Notes**: Extract action items, decisions, owners, deadlines
4. **General Analysis**: Summarize, extract key points, identify risks

After analysis, a green badge confirms: "Analyzed 100% locally. Your document was processed by AI running in your browser. Zero data was sent to any server."

## Don't trust us — verify it

Open your browser's DevTools (F12), go to the Network tab, and run an analysis. You'll see zero network requests during processing. This is the strongest possible privacy architecture: there is no server to breach, no logs to subpoena, no API call to intercept.

## Why it's free

LocalScore costs us nothing to operate. The user's GPU does all the work. No API calls, no Gemini tokens, no server compute. So we made it free — no credits, no limits, no catch.

It drives traffic to [bilko.run](/projects) and builds trust. When someone sees that we offer a genuinely free, genuinely private tool, they're more likely to try the paid tools too.

## The future of browser AI

Gemma 4 is the beginning, not the end. As models get smaller and more capable, more tasks will move to the browser:
- Real-time translation without internet
- Private code review on sensitive codebases
- Medical document analysis that stays on the hospital network
- Legal document review that never leaves the law firm

We're betting that privacy-first AI tools will become a category, not a feature.

## Try it

[LocalScore](/projects/local-score) works in Chrome 113+ and Edge 113+. First visit downloads the model (~1.6GB). After that, everything works offline.

Your documents stay yours.

## FAQ

**Is it as good as ChatGPT or Claude?**
No. Gemma 2B is smaller and less capable than frontier models. But for document analysis — extracting key terms, summarizing, identifying risks — it's surprisingly good. And the trade-off (slightly less capable but completely private) is worth it for sensitive documents.

**Does it work on my phone?**
Not yet. WebGPU support on mobile browsers is still limited. Desktop Chrome and Edge work reliably.

**Can I use this for HIPAA-compliant workflows?**
The tool itself doesn't store or transmit data, which removes the primary HIPAA concern. But consult your compliance team — HIPAA compliance involves more than just data transmission.`,
    'deep-dive',
    new Date().toISOString(),
  );

  // Seed "10 Tools, Solo" blog post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    '10-tools-solo-what-i-learned-shipping-bilko-run',
    '10 Tools, Solo: What I Learned Shipping bilko.run',
    'I built 10 AI tools in one sprint — from landing page audits to browser-based private document analysis. Here\'s what actually worked, what surprised me, and what I\'d do differently.',
    `## The number that surprises people

10 tools. One person. One sprint.

Not 10 MVPs. Not 10 landing pages with "coming soon" badges. 10 fully functional tools with scoring engines, compare modes, generate modes, personal libraries, cross-tool promotion, a blog, a payment system, and an admin dashboard.

People ask how. The honest answer: AI as a co-pilot and a very specific architecture decision.

## The architecture that made it possible

Every tool on [bilko.run](/projects) follows the same pattern:

1. **Input**: User pastes text (headline, ad copy, thread, email, document, tool list, URL)
2. **Analysis**: Gemini 2.0 Flash processes it against a calibrated scoring prompt
3. **Output**: Score card + section breakdown + actionable fixes + roast/verdict

The frontend uses a shared component kit — ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo. Each tool page is 200-400 lines, not 1,000+. The heavy lifting lives in reusable components.

The backend follows the same pattern: validate input, check auth, rate-limit, call Gemini, parse JSON, save to DB, return results. A shared helper handles the boilerplate for generate endpoints.

This means adding a new tool is a matter of writing a scoring prompt and a page layout. Not building infrastructure from scratch.

## What each tool taught me

**[PageRoast](/projects/page-roast)** — The roast line was an accident. I added it as a debugging artifact. People screenshotted it and shared it. Lesson: the most shareable feature isn't always the most useful one.

**[HeadlineGrader](/projects/headline-grader)** — Adding a Generate mode (not just scoring) doubled the tool's value. People who came to score a headline stayed to generate five better ones.

**[AdScorer](/projects/ad-scorer)** — Platform-specific scoring matters. A great Facebook ad is not a great Google ad. The same copy scores differently depending on where it runs.

**[ThreadGrader](/projects/thread-grader)** — The X algorithm data (reply = 27x a like, bookmarks = 5x) surprised users. They knew threads mattered but not why specific structures worked.

**[EmailForge](/projects/email-forge)** — The deliverability score was inspired by Instantly.ai. Flagging spam trigger words before sending prevents emails from dying in spam folders.

**[AudienceDecoder](/projects/audience-decoder)** — The personality typing (Provocateur, Amplifier, Educator, Slow Burn, Generalist) gave people an identity to rally around. More shareable than raw engagement numbers.

**[LaunchGrader](/projects/launch-grader)** — Born from a Reddit thread with 431 comments asking for product reviews. The demand was obvious once I looked for it.

**[StackAudit](/projects/stack-audit)** — "The SaaS model is quietly falling apart" (461 upvotes, 283 comments). Four corroborating threads. Clear pain, clear gap, clear solution.

**[Stepproof](/projects/stepproof)** — The hardest to build as a web service. YAML parsing, multi-provider LLM adapters, assertion engines — all ported from a CLI tool into a Fastify endpoint.

**[LocalScore](/projects/local-score)** — The outlier. Runs entirely in the browser via WebGPU. Zero server involvement. Free forever. Timed with Gemma 4's launch. Our most technically interesting tool.

## What surprised me

**Credits beat subscriptions.** Every Reddit thread about SaaS pricing complaints is about subscriptions. $1/credit with no recurring charge removes the biggest objection.

**Cross-tool handoffs work.** "Turn this headline into ad copy" and "Generate an email sequence from this thread" connect the tools into workflows. No single-tool competitor can do this.

**Below-fold content matters more than I thought.** Educational sections (How It Works, FAQ, scoring explanations) keep users on the page and build trust. Pages with this content have lower bounce rates.

**The blog drives tool discovery.** Posts about how tools were built (with real Reddit threads as evidence) attract exactly the right audience.

## What I'd do differently

**Ship the blog earlier.** I built 10 tools before writing a single blog post. The blog should have been tool #1 — it's the top of the funnel.

**Start with 3 tools, not 10.** PageRoast, HeadlineGrader, and StackAudit cover three distinct verticals and validate the platform model. The other 7 could have been added based on usage data.

**Test the payment flow sooner.** I added Stripe early but didn't test the full purchase-to-credit-to-usage flow with real users until late.

## The tools

All 10 are live at [bilko.run/projects](/projects). Your first analysis is free. After that, $1/credit or $5 for 7. [LocalScore](/projects/local-score) is completely free — it runs in your browser.

If you're building something and need marketing help, start with [PageRoast](/projects/page-roast). If you're spending too much on tools, start with [StackAudit](/projects/stack-audit). If you have sensitive documents, start with [LocalScore](/projects/local-score).

## FAQ

**Did you really build all of this alone?**
Yes, with AI as a co-pilot. Claude for architecture decisions, code reviews, and the copy you're reading. Gemini for the tool analysis engines. The code is mine; the speed is AI-assisted.

**How long did it take?**
The core platform (10 tools + blog + payments + admin) shipped in one intensive sprint. Each tool takes 2-4 hours when the architecture is reusable.

**Is it profitable?**
Early. The credit model means every use generates revenue. No free-tier subsidization problem.`,
    'build-log',
    new Date().toISOString(),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Week-in-review: Apr 13-20, 2026 — one post per active project
  // ─────────────────────────────────────────────────────────────────────

  // Seed OutdoorHours week-in-review post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'building-outdoorhours-121-months-of-weather',
    'Building OutdoorHours: 121 Months of Weather in Six Commits',
    'We shipped a 10-year, six-county outdoor-comfort dashboard in a week — from a single-screen v1 to multi-range, multi-region bundles with 121 AI-written monthly narratives. Here is what actually happened.',
    `## The question behind the tool

"Was it comfortable to be outside?"

Every climate dashboard I could find answers a different question — averages, anomalies, trend lines. None of them answer the one that matters if you're picking where to live, when to travel, or where to hold an outdoor event: **how many hours of the year can you actually be outside without sweating, shivering, squinting, or getting rained on?**

So we built [OutdoorHours](/projects/outdoor-hours) (internal name KOUT-7). Six commits between April 17 and April 19. By the end of the week the dashboard covered 124 data files, 121 months of AI-written narratives, and four time ranges across six counties.

## The four-rule model

Every hour of the last 30 years is scored against four non-negotiable rules. All four must pass:

- **Daytime** — the sun is up
- **Temperature** — 45°F to 86°F
- **UV index** — 6 or lower
- **Rain** — 1 mm/h or less

Hourly ERA5 reanalysis data for each region goes in. A single boolean comes out: comfortable or not. Sum the comfortable hours over a month, a year, a decade — and you have a ranking that survives comparison across climates that are nothing alike.

The rules are strict on purpose. Loosen any one and the ranking collapses into "which region has more daylight." All four together isolate the thing people actually feel when they step outside.

## v1 → v4 in three days

**v1 (commit \`de324e3\`)** shipped the skeleton: two hard-coded regions (Bay Area vs. Seattle), Plotly charts, four grain levels (yearly → monthly → daily → hourly), and a single time range. About 1,134 lines of \`OutdoorHoursPage.tsx\` doing too much.

**v2 (commit \`5348f5e\`)** rebuilt the Four Rules section as color-coded cards with a "4 of 4 must pass" badge, then added the thing people asked for in the first five minutes: **row-click drill-in**. Click a month, get the daily breakdown. Click a day, get the 24 hourly rows with the specific rule that failed on each one. The hourly schema surfaces the four drivers (day? / temp / UV / rain) alongside the score so you can see *why* an hour didn't count.

**v3 (commit \`e8d2aca\`)** broke the two-region ceiling. Region metadata moved into the data bundles themselves — colors, default-on flags, display names — so adding a new region is a Python-side registry change plus a data export. Added San Francisco (Mission / Pacific Heights / Ocean Beach) and Snohomish County, WA. Time range picker (1y / 5y / 10y / 30y) with lazy-loaded bundles and a leaderboard that stars the leader in champagne. Post-v3 bundle sizes: **265 KB / 1.3 MB / 2.9 MB** for 1y / 5y / 10y.

**v4 (commit \`7bd2292\`)** added the "Writer's Take" — an AI-generated one-sentence summary per bundle, rendered as an amber card to visually separate narrative from numbers. The narratives ship *pre-computed* inside the JSON; zero runtime LLM calls, zero latency, zero API cost per page view.

## 121 months of narratives, zero server load

The narratives commit (\`8b8d897\`) is the piece I'm most proud of. Every one of 121 monthly buckets now has an AI-written summary that compares all active regions on stay-outside hours — the leader, the laggard, and the weather driver that explains the gap. It appears inside the drill-in panel when a user opens a month.

The trick: we generated all 121 narratives offline with a local \`claude -p\` pipeline, baked them into the data bundles at export time, and now they ship as static JSON. The entire OutdoorHours tool is a static SPA. No server-side AI. No per-request cost. No rate limits.

Total narrative payload: about **21 KB** of metadata across all time ranges. That's the unit cost of adding an LLM-authored voice to a 30-year dataset.

## The data refresh that doubled coverage

Commit \`75bb766\` is unglamorous but mattered: 124 files touched, adding Charlotte County, FL (Punta Gorda / Port Charlotte / Englewood), partial coverage for Albemarle County, VA (Charlottesville / Crozet / Earlysville, limited by Open-Meteo quota), and completing Snohomish County with the missing Edmonds series. Westchester NY and Maui HI are registered in the pipeline but filtered out of the active bundle until their data backfills complete.

Post-refresh bundle sizes: **509 KB / 2.5 MB / 5.0 MB**. Still comfortably under the "slow-3G fails" threshold even for the 10-year bundle.

## What else shipped this week in the Bilko repo

Three smaller wins that matter more than they look:

- **LocalScore E2E tests (\`9141c44\`)** — 9 Playwright tests across all four analysis modes (contract, financial, meeting, general), driven by a mocked Anthropic Gemma engine injected via \`addInitScript\`. This unblocks refactors of the browser-AI tool without needing a GPU in CI.
- **Simplify + parallelize (\`e5d8a80\`)** — extracted a 235-line fixtures file, removed a dead \`setStatus('loading-model')\` call React had already batched away, and flipped \`fullyParallel\` on in the Playwright config. Test suite went from **17.9s → 5.7s**.
- **Security: gate the test seam (\`debab78\`)** — the \`window.__LOCALSCORE_MOCK_ENGINE\` hook we used to inject a fake AI in tests was shipping to production, meaning any browser extension or XSS in the page could swap our in-browser AI for one of theirs and exfiltrate user documents. Now gated behind a \`__TEST_SEAMS__\` Vite define that evaluates to \`false\` in production and gets dead-code-eliminated from the bundle. Verified: zero occurrences of \`__LOCALSCORE_MOCK_ENGINE\` in the production build.

Plus **CardSpotter planning (\`aca9910\`)** — 10 agent-ready work packages (1,974 lines of markdown across 11 docs) for the next bilko.run tool: upload a card photo, get a structured list plus a poker-hand evaluation. Implementation lands next week.

## What I'd do differently

I'd build the N-region architecture in v1. We paid for "two hard-coded regions" twice — once in v1, once in v3 when we tore it out. If you're building a comparison tool, there is no such thing as "just two things" — there's always a third, and a fourth, and a sixth county in Florida that someone in the Discord wants added.

I'd also pre-generate narratives earlier. Monthly narratives look like a late-game polish feature. They're actually the thing that makes the drill-in feel human. Adding them in v4 was fine; adding them in v2 would have been better.

## Try it

[OutdoorHours](/projects/outdoor-hours) is live with 1-year, 5-year, 10-year, and 30-year views across six regions. Free, no credits, no login. Drill into any month to see the hour-by-hour breakdown and the Writer's Take.

If you want to see the broader platform, [the full tool list is here](/projects). And if you're running a landing page without clear data backing, [PageRoast](/projects/page-roast) will tell you exactly where it breaks.

## FAQ

**Why not just show average temperature?**
Because average temperature lies. A city that averages 65°F year-round might do it by being 90°F all summer and 40°F all winter — zero comfortable hours. Hour-by-hour scoring catches that.

**Where does the weather data come from?**
Open-Meteo's ERA5 historical reanalysis. Hourly resolution going back to 1996.

**Why pre-generate the narratives instead of calling an LLM live?**
Cost and latency. 121 months × N regions × every page view = a bill. Baking them into the bundle at export time means the tool is static JSON + a React page. Zero per-request cost.`,
    'build-log',
    new Date().toISOString(),
  );

  // Seed Burrow week-in-review post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'burrow-from-background-task-to-cron-orchestrated',
    'Burrow, Week 16: From Crashing Background Task to Cron-Orchestrated',
    'Our local-first social automation agent kept silently double-posting and losing settings on restart. Four commits later it is cron-orchestrated, traced, idempotent, and routing replies through a seven-mode tone palette. Here is what actually changed.',
    `## Why this week mattered

Burrow is our local-first social media agent — a FastAPI server that drives real Playwright-Chromium browsers to scroll, like, and reply across X, Reddit, LinkedIn, and Facebook. Everything runs on the laptop, nothing routes through a cloud API, and every action hits the same DOM a human would.

Week 16 was the week Burrow graduated from "background task that occasionally crashes and silently double-posts" to something I trust to run unattended overnight. Four commits, 77 files in the largest one, and the stack ended the week with cron-level orchestration, Playwright tracing, a reply-tone doctrine, and atomic reply idempotency.

## Commit 1 — The big refactor (\`07a85bc\`, +7,527 lines)

Before this week, the orchestrator ran in-process as a background task inside the FastAPI server. Two problems: it crashed on malformed state, and running \`--status\` from the dashboard accidentally triggered spurious run markers because the engine and the status check shared a database.

**The fix:** move orchestration out of the process entirely.

- \`scripts/orchestrator-cron.sh\` runs every 5 minutes via \`flock\` (a Linux mutual-exclusion lock, so two ticks can't overlap).
- The in-process \`OrchestratorEngine\` now runs with \`read_only=True\` — dashboard can read state, never write.
- Dashboard write routes return **403 if \`engine.read_only\`**, **409 if another pipeline is mid-run**. No more races.

The tradeoff is real: 5-minute granularity means sub-minute reactions are gone. For social posting that's fine. For a trading bot it wouldn't be.

The other big move in this commit: **14 Claude prompts moved out of Python and into \`data/prompts/**/*.md\`**, loaded by a new \`app/shared/prompts.py\` using Python's \`string.Template\` with an LRU cache. Every pipeline — X, Reddit, LinkedIn, Facebook — now sources its drafting, planning, and review prompts from markdown. You can tune tone without a deploy.

### The reply doctrine

The most opinionated piece of the refactor is the tone doctrine. v2 had a single reply template and every response sounded like the same robot. v3 shipped \`data/x-reply-strategy.md\` with **seven modes**:

- \`affirm_reinforce\` — "yes, and here's the other reason"
- \`quiet_cosign\` — a minimal nod
- \`lived_parallel\` — "same, different context"
- \`specific_noticing\` — pick out a detail most readers missed
- \`genuine_curiosity\` — one question, not interrogation
- \`dry_oneliner\` — wit
- \`resonance_close\` — validation on an emotional post

Most modes ban ending on a question and ban opening with "actually" or "hot take." LinkedIn got its own stricter four-verb doctrine: commend → agree → expand → wish.

The mode gets chosen per-candidate by the planner based on the tweet's content class. A venting post gets \`resonance_close\`. A witty observation gets \`dry_oneliner\`. One template → seven; the feed stops sounding like one person replying to everything the same way.

### DeepResearch infographics

Also slipped into this commit: a Step 6 that auto-generates infographics for research runs via Gemini Nanobanana, exports to \`.txt / .md / .docx / .pdf\`, and stores 50 runs in memory with a 24-hour TTL. Desktop gets a \`ResearchTab.tsx\` with a per-image gallery. This is the bridge between Burrow's Claude-driven research output and something visual you can actually share.

## Commit 2 — Tracing and guards (\`7f3ae92\`)

Cron was reporting "3 replies posted" when X was silently throttling 2 of them. Every action looked like a success in the logs because we weren't looking at the activity stream for error actions.

Four things changed:

- **Silent failure detection**: runs that finish but have error actions in \`activity_stream\` now flip to \`status='failed'\`, not \`completed\`. Dashboard stops lying to you.
- **Playwright tracing** wraps every scroll session. On crash, we retain a \`.zip\` in \`downloads/traces/\` replayable via \`playwright show-trace\`. Forensics, not logs.
- **Circuit breaker persistence**: the X tracker's \`session_state\` KV table now stores product-reply cooldown markers across sessions. 45-minute minimum gap survives process restarts.
- **New-account warmup**: capture-threshold lowered from P50 → P25 for accounts with less than two weeks of history. A brand-new account was filtering 100% of tweets because the capture-policy weights were tuned on older data.

## Commit 3 — Atomicity and schema v2 (\`b78a03c\`)

The subtle bug was this: Burrow would start to reply, navigate to the tweet, X would force a logout or crash the tab, the process would restart, and on the next cron tick Burrow would reply *again* — because the interaction row hadn't been written yet.

**Fix:** \`_post_reply\` now pre-writes a \`reply_pending\` interaction row **before** navigating. If the process dies, the pending row blocks the next session from re-attempting. The idempotency cache treats any row — pending or posted — as "already tried."

Other atomicity wins:

- **Settings persistence**: PUT \`/settings\` now writes \`interval\`, \`window\`, \`jitter\`, \`duration\` to \`schedule_state.config_overrides_json\`. Restarts no longer wipe tuning.
- **Content calendar schema v2**: \`posts.category\` is now \`NOT NULL DEFAULT 'general'\` with a \`schema_version\` table so future migrations are tracked.
- **High-opp hysteresis**: if the 24-hour success rate on high-opportunity replies drops below 60% (over 5+ attempts), the phase skips entirely. X is telling us to cool off; we listen.
- **Tier-3 fallback**: classifier fallback bumped from "after 2 consecutive failures" to "after 3" with a warning on the third.
- **\`/locator/wait\` endpoint**: pre-waits for a Playwright selector to become visible before extracting. Kills the "Execution context was destroyed" race that showed up when the feed re-rendered mid-extract. Costs 50–200 ms per extract; worth every millisecond.
- **Timezone helper**: \`app/shared/tz.py\` surfaces \`*_local\` timestamps so the dashboard shows PDT instead of UTC.

## Commit 4 — Dedup funnel, prompt escaping, high-opp caps (\`5164fbb\`)

Three tight fixes that each unblocked a real run:

**Dedup was over-aggressive.** \`_dedup_against_tracker\` was using the \`seen_tweets\` table (which records every tweet we ever *rendered*, 8K+ rows) as a deny-list. But the intent of dedup is "don't double-reply to the same tweet," not "never show a tweet we've ever seen." A run had 71 feed items, the old dedup killed it to 3 candidates, the planner had nothing to work with. The fix: dedup against the \`interactions\` table only. Same run, post-fix: **71 → 147 candidates after merge**. \`seen_tweets\` stays populated for analytics but no longer chokes the planner.

**Prompt \`$\` escaping.** \`string.Template.safe_substitute\` treats \`$word\` as a placeholder. Tweets like "I love $Bitcoin" triggered false "unresolved placeholder" warnings and could leak a literal \`$$Bitcoin\` into the Claude prompt. Fix: escape literal \`$\` to \`$$\` before substitution, collapse back to \`$\` after. Claude sees \`$Bitcoin\` exactly as written.

**High-opportunity cap bypass.** High-opp replies (crafted replies to high-visibility, low-reply-count tweets) were sharing a budget with organic replies. A run queued three high-opp candidates; all three got dropped because two organic replies had already eaten the 2-per-session cap. Now high-opp has its own \`daily_high_opp_limit=5\` budget, passed through as an \`is_high_opp\` flag. Five crafted replies plus two quick reactions per day, no fighting.

## What shipped, in one line per commit

| Commit  | Focus       | Outcome                                                                   |
|---------|-------------|---------------------------------------------------------------------------|
| 07a85bc | Architecture| Cron decoupling, 14 prompts externalized, 7-mode reply doctrine, infographics |
| 7f3ae92 | Hardening   | Silent-failure detection, Playwright tracing, persistent circuit breakers |
| b78a03c | Atomicity   | Pre-write pending rows, settings persistence, locator-wait, schema v2     |
| 5164fbb | Fixes       | Dedup 71→147, prompt \\$ escaping, high-opp budget isolation              |

## What I'd do differently

I'd have moved prompts to files in week 2, not week 16. Every Python redeploy to tweak a one-line prompt tweak was a tax I paid for months. LRU-cached markdown loaders took 40 lines to add.

I'd also have wired Playwright tracing before the first overnight run, not after watching three mystery failures with no forensic trail. Tracing is cheap. Post-hoc debugging from partial logs is not.

## What's next

Now that the cron loop is honest about failures, the next week is tuning: can we lower the 45-minute product cooldown (probably yes), can we raise the hysteresis floor (probably no), does the lowered capture P25 produce measurably better engagement on new accounts (unknown — need a week of data).

Burrow isn't a [bilko.run](/projects) tool — it runs on my laptop, not in the cloud. But the reply doctrine work is interesting enough that we may spin out a scored version of it inside [ThreadGrader](/projects/thread-grader) or [AudienceDecoder](/projects/audience-decoder) next sprint.

## FAQ

**Is Burrow for sale?**
No. It drives real browsers on real accounts, which is the opposite of what platforms want automated, and we run it against our own accounts only.

**Why local-first instead of a cloud API?**
Because every API path (X, LinkedIn, Reddit) is either rate-limited, stripped of the features we need, or both. Driving the actual DOM is the only way to do the full surface.

**What's the reply success rate after the hardening?**
Measurable after one more week of data. Before the hardening we literally didn't know — the logs lied. Now we do.`,
    'build-log',
    new Date().toISOString(),
  );

  // Seed npr-podcast week-in-review post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'npr-ad-skipper-gemini-only-and-97-percent-agreement',
    'The NPR Ad Skipper: Going Gemini-Only and Getting 97.5% Agreement with Claude',
    'We ripped out 2,000 lines of OpenAI and Whisper code, moved the entire ad-detection pipeline onto Gemini, then ran it head-to-head against Claude Opus on a 15-episode corpus. 58 of 60 ad blocks matched. Here is why that matters.',
    `## The tool

[npr-podcast](https://github.com/StanislavBG) is an ad-free podcast player for NPR shows — The Indicator, Planet Money, Hidden Brain, Short Wave, Up First. It fetches the RSS feed, transcribes the audio, detects ad breaks, and auto-skips them during playback. Front-end is React; workflow is orchestrated through [bilko-flow](/projects) (our open-source pipeline library, more on that shortly); audio processing hits Gemini.

This week the tool went through four real changes: a big architectural simplification, a bug that was freezing the UI on mobile, a full classifier evaluation, and a mobile-UX polish pass. Eleven commits in a single day on April 19.

## 1. Ripping out OpenAI and Whisper (commit \`c1245f2\`)

The pipeline used to have two speech-to-text paths (OpenAI Whisper + Gemini) and **18 regex heuristics** for ad-boundary detection (\`AD_PATTERNS\`, \`CONTINUE_BREAK_RE\`, \`extendEndBoundaries\`, and friends). It was a mess of fallbacks: if Whisper fails, use Gemini; if the LLM boundary looks off, run the regex extender.

We deleted all of it. 2,000+ lines gone. The pipeline is now:

- **Speech-to-text**: \`gemini-2.0-flash\` (fast, cheap, good enough)
- **Ad classification**: \`gemini-2.5-pro\` (slower, smarter, $-per-episode tolerable)
- **Boundary refinement**: the same classification call, no post-hoc regex

The regex heuristics existed because our first classifier was bad at production credits. "This episode was produced by..." would end the transcript without flagging the sponsors that followed. Upgrading the prompt to explicitly mark credits as the *opening* of a post-roll break — plus moving classification to \`gemini-2.5-pro\` — killed the need for the regex extender entirely.

When \`GEMINI_API_KEY\` isn't set, the pipeline now emits **zero ad blocks with a diagnostic message**. Previously it would silently fall back to regex-only detection and miss 30% of ads. Silent failure is worse than loud failure.

## 2. The eval harness and 97.5% agreement (commits \`ff85712\`, \`8e42b6e\`, \`f31ba0a\`, \`351794d\`)

Here's the question anyone building an LLM pipeline should ask but usually doesn't: **"How do I know this is actually working?"**

We built an eval harness in \`scripts/eval-classifier.ts\` that runs two models — Gemini 2.5 Pro and Claude Opus 4.7 — over the same 15-episode fixture corpus and compares block-level agreement. The corpus spans all five podcasts, episodes ranging from 15 to 7,178 words of transcript, with 2–9 ad breaks each.

Results: **58 of 60 ad blocks matched. Two false negatives. One false positive. 97.5% F1.**

The two disagreements are policy questions, not capability gaps. The models disagreed on whether NPR live-tour promos count as ads — which is an editorial call, not a correctness question. On the 58 they both agreed on, the block boundaries match to within a few words.

That number is load-bearing for the whole architecture: if the cheaper, faster model disagreed with the frontier model on actual ad detection, we'd have to pay for the frontier model at inference time. 97.5% agreement means we can run Gemini in production and trust Claude as an oracle for regression testing.

The 15 fixtures — 42 to 334 events per episode, ~730 KB total — now live in \`tests/fixtures/runs/\`. Replay tests (\`tests/fixtures-replay.spec.ts\`) run the reducer against captured SSE event streams without any LLM calls. CI runs these offline. Fast, deterministic, free.

## 3. The chunking-stuck bug (commit \`ffc84dc\`)

User report: "UI freezes when playing online, chunks don't process properly."

Three bugs, all of them mine, stacked on top of each other:

**(a) SSE reconnect was a TODO comment.** On any network blip — mobile sleep/wake, proxy timeout, aggressive CGNAT — the UI froze while the server kept working. Fix: exponential backoff from 1s to 30s, snapshot re-fetch, resubscribe with the correct \`lastEventId\` so we don't replay events we've already applied.

**(b) Reducer monotonicity.** The \`step_emit_skips\` event handler could *shrink* \`totalChunks\` because it took the \`min\` of the existing max and the event's value. If events arrived out of order (which they do under reconnect), the total would visibly tick downward. Fix: \`Math.max\`, not \`Math.min\`.

**(c) RunPanel progress > 100%.** Displayed raw completion count without clamping. Under out-of-order events, the bar would show 103% and looked broken. Fix: clamp to \`[0, total]\`.

Added 7 unit tests in \`tests/run-store.spec.ts\` covering idempotent replay, out-of-order completion, and monotonic chunk counts. Also fixed \`parseDuration()\` to accept numeric durations: Planet Money's feed sends numbers, Hidden Brain sends strings. One more case where "the real world is more annoying than the test fixtures" bit us.

## 4. Mobile UX and a11y polish (commit \`3da5812\`)

Nine small changes, each worth about 2% on its own, collectively noticeable:

- Tap targets on play/skip bumped to **≥44px** (Apple HIG minimum).
- \`focus-visible\` rings on every interactive control.
- Semantic roles: \`role=switch\` on the auto-skip toggle, \`aria-label\` on player buttons, \`aria-expanded\` / \`aria-controls\` on RunPanel.
- Episode tile labels bumped from 10–11px to 12px.
- WebKit scrollbars styled to match Firefox's \`scrollbar-width: thin\` on sandbox detail panes.

Accessibility work usually doesn't make it into build logs because it's not glamorous. It matters: screen readers now name the player controls correctly, and the tool stops failing \`axe-core\` audits.

## 5. bilko-flow moves to npm (commits \`72a37ad\`, \`40bf848\`)

The pipeline library — [bilko-flow](/projects) — used to ship via a Git URL in \`package.json\`. Deploys were brittle: Replit couldn't always reach the private repo, and \`npm install\` was slow because it cloned the whole history.

We moved bilko-flow to the public npm registry. Two commits, because v0.3.0's published tarball didn't include \`src/\` (npr-podcast imports some paths directly from source), so we bumped to v0.3.1 and added \`src\` to the \`files\` whitelist. Fixed in one line.

The broader story of that npm publish is [its own post](/blog/bilko-flow-v0-3-1-first-npm-release).

## What I'd do differently

I'd have written the eval harness before removing Whisper, not after. We ran the removal on faith and got lucky that 97.5% agreement held. If the eval had come back at 82%, we'd have reverted — but we wouldn't have known until a week of user reports came in.

I'd also have built the fixture corpus from day one. 15 captured pipeline runs turn "does this change break anything" from a 20-minute manual test into a 9-second replay. Every LLM pipeline should ship with recorded fixtures before it ships anything else.

## What's next

Ad classification accuracy is high enough that we're moving to the playback layer: smoother skips, no audible glitch at boundaries, and optional "skip with a beep" for users who want to know an ad was there. Also investigating whether we can precompute ad blocks on the server when the episode first drops, so new listeners get zero-latency skips.

## FAQ

**Why Gemini and not Claude in production?**
Cost and speed. \`gemini-2.0-flash\` is ~10× cheaper than Opus and ~3× faster for STT. The 97.5% agreement says we don't pay for the difference.

**Does this work on podcasts that aren't NPR?**
The RSS fetcher is NPR-flavored (handles their specific feed quirks). The classification pipeline would work on any podcast — NPR just has consistent ad structure so it's a good starting point.

**Will this be a bilko.run tool?**
Probably not — it's not really monetizable as a one-shot AI analysis. But the eval harness pattern and the bilko-flow-based pipeline are both going to show up in other bilko.run tools.`,
    'build-log',
    new Date().toISOString(),
  );

  // Seed bilko-flow week-in-review post
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'bilko-flow-v0-3-1-first-npm-release',
    'Shipping bilko-flow v0.3.1: Our First Public npm Package',
    'We open-sourced the workflow library that powers the NPR ad skipper. Two commits, one license change, one missing folder in the tarball — and a pile of lessons about what it actually takes to publish a usable package.',
    `## What bilko-flow is

[bilko-flow](https://www.npmjs.com/package/bilko-flow) is a TypeScript library for describing, validating, and executing deterministic workflows from natural language. It's the piece that sits between "a user describes what they want" and "an executor runs a reproducible pipeline."

Three capabilities that matter:

- **Text-to-pipeline**: an \`LLMPlanner\` turns a natural-language description into a validated DSL document
- **Determinism grades**: every workflow declares itself \`Pure\`, \`Replayable\`, or \`Best-Effort\`, and the compiler enforces it
- **Provenance**: the reference executor hashes inputs with SHA-256 and signs runs with HMAC, so you can prove what actually ran

It also ships React components (\`FlowProgress\`, \`FlowCanvas\`, \`FlowTimeline\`) for visualizing running pipelines, and adapters for memory stores, Ollama, vLLM, TGI, and LocalAI.

Internally, bilko-flow has been the backbone of the [NPR ad skipper](/blog/npr-ad-skipper-gemini-only-and-97-percent-agreement) pipeline for months. This week it graduated to a public npm package.

## Commit 1: MIT license (\`40636a9\`)

The previous license was a boilerplate "all rights reserved" — fine for internal use, broken for everything else. npm's ecosystem assumes permissive licensing; a proprietary package can't be a transitive dependency of anything open.

Switching to MIT was a five-line change: license header, \`LICENSE\` file, \`"license": "MIT"\` in \`package.json\`, \`README\` badge, and removing \`"private": true\`. The important part isn't the lines — it's the decision that this library is worth more to us as something others can build on than as something we keep to ourselves.

Not every internal library clears that bar. bilko-flow does because the contract (a typed DSL with determinism grades) is the sort of thing that's genuinely useful to other people building LLM pipelines, and nothing in it is specific to what we do with it.

## Commit 2: The src/ tarball bug (\`581175f\`)

v0.3.0 shipped to npm. The NPR ad skipper picked it up. Build broke.

The reason: npm's default \`files\` whitelist includes \`package.json\`, \`LICENSE\`, and whatever \`main\` points to. It does *not* include \`src/\`. Our \`package.json\` had an explicit \`files\` list — which, because it was explicit, overrode the default — and \`src\` wasn't in it.

The consumer (npr-podcast) does two things that needed source:

1. **Vite import aliases** — imports resolve directly to \`node_modules/bilko-flow/src/*.ts\` instead of the compiled \`dist/\` exports, for hot reload during development.
2. **\`patch-package\` patches** — specifically \`src/react/step-detail.tsx\` had a local override applied at install time.

Without \`src\` in the tarball, both patterns silently break. The Vite alias resolves to a non-existent file; \`patch-package\` fails because there's nothing to patch.

The fix was a single line:

\`\`\`diff
 "files": [
   "dist",
-  "README.md"
+  "README.md",
+  "src"
 ]
\`\`\`

Bumped to v0.3.1. npr-podcast's \`package.json\` updated to \`"bilko-flow": "^0.3.1"\`. Build fixed.

## Lessons from a two-commit release

This is the kind of release people don't write build logs about. Two commits. No new features. No architecture. But it's the one that took the library from "something internal" to "something anyone can \`npm install\`," and the gap between those two states is full of exactly this kind of footgun.

**Publish early so you find the footguns early.** We'd have caught the missing \`src/\` months ago if bilko-flow had been on npm in any form. Internal consumers using Git URLs don't exercise the tarball path. Your first external consumer is your first real test.

**The \`files\` field is a fence, not a door.** If it's defined, npm uses it *instead of* the defaults. Every item you want shipped has to be listed.

**License first, not last.** The MIT switch was technically trivial but unblocked everything downstream. We could have done it in week 1 of the project and saved ourselves the last-minute audit.

## What bilko-flow is good for

If you're building an LLM pipeline and you're tired of:

- manually validating that the JSON your LLM emitted is a valid pipeline spec
- reasoning about whether a step is reproducible or flaky
- reimplementing the same React \`<ProgressBar />\` for every new workflow tool

bilko-flow gives you a typed DSL, compiler-enforced determinism grades, and drop-in React components. It's Apache-licensed (well, MIT now) and on npm:

\`\`\`bash
npm install bilko-flow
\`\`\`

The [NPR ad skipper](/blog/npr-ad-skipper-gemini-only-and-97-percent-agreement) is the reference consumer. Four pipelines (fetch → parse → STT → classify → play) are orchestrated through bilko-flow, visualized with \`FlowProgress\`, and checkpoint their state so a crash mid-episode resumes cleanly.

## What's next

The short list for v0.4:

- **\`proposeRepair\`** improvements — the planner protocol's four methods include \`proposeRepair\` for fixing broken runs, and it's the least-tested path
- **Better adapter docs** — the Ollama / vLLM / TGI / LocalAI plug-ins all exist but their docs assume you already know how to configure each
- **Streaming executor** — right now the reference executor is synchronous; streaming would unblock use cases where a long-running step wants to report progress

And if you build something on bilko-flow, tell me. The whole reason it's public is that the contract is general enough to be worth sharing.

## FAQ

**Is bilko-flow competing with Temporal / Inngest / LangGraph?**
No. Temporal and Inngest are managed workflow services; LangGraph is a graph-state library. bilko-flow is closer to a typed DSL with provenance — you could run it *inside* an Inngest function or alongside LangGraph.

**Why the determinism grades?**
Because "is this reproducible?" is the question every LLM pipeline eventually has to answer, and declaring it in the spec beats re-deriving it from the code.

**Where do I read the full docs?**
[bilko-flow on npm](https://www.npmjs.com/package/bilko-flow) — README is the canonical doc. Source is in the tarball (now) for anyone who wants to read the types directly.`,
    'deep-dive',
    new Date().toISOString(),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Week-in-review: Apr 19-27, 2026 — OutdoorHours v5 → v13
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'outdoorhours-week-2-from-fixed-rules-to-rule-engine',
    'OutdoorHours, Week 2: From Four Rules to a Rule Engine',
    'Last week OutdoorHours shipped with one fixed answer to the question "was it comfortable to be outside?" This week — fourteen commits, nine regions, three continents — the answer became a setting users can rewrite, share by URL, and run against their own definition of comfortable.',
    `## The opinionated tool problem

Every dashboard with a thesis eventually meets the user who disagrees with the thesis. OutdoorHours week 1 had a single, sharp definition of "comfortable": daytime, 45–86°F, UV ≤ 6, rain ≤ 1 mm/h. All four pass or the hour doesn't count. We shipped that on a Sunday and felt smart for about eighteen hours.

By Monday the question was: *whose comfortable?* The Sun Seeker who needs 80°F to feel alive. The cloudy-grey-and-cold person who treats 60°F as ideal. The trail runner who'll go in the rain but not in heavy haze. Everyone has a different answer, and the leaderboard ranking flips depending on which definition wins.

The week's shipping log — fourteen commits between April 21 and April 27 — is the trace of that conversation. The tool went from a fixed-rule classifier to a configurable rule engine, from two regions to nine across three continents, and from "here is the answer" to "here is your answer."

## v5 + v6: the leaderboard exposed the obvious

The first crack came from looking at our own output. The County Leaderboard widget (v5, [\`ec6a0c3\`](#)) was supposed to be a quick-glance ranking — who has the most stay-outside hours over the selected range. Useful, except we'd been treating "Bay Area" as a place. It isn't. Pacific Heights, Mission, and Ocean Beach are three places that disagree about whether it's comfortable on any given afternoon, and the leaderboard refused to combine them.

That forced [v6 (\`1bec861\`)](#): per-county **Character Profiles** — "Meet the Counties." Each region picked up a paragraph of personality on the deep-dive panel: who thrives there (a sun chaser, a cloud sympathizer, a humidity tolerator), who doesn't, and what the weather does for a living. Our nine-region bundle now reads as nine arguments for nine kinds of life, not nine bars on a chart.

That, in turn, made it obvious that the Four Rules weren't telling the whole story. Pacific Heights and Mission both pass the four — but at very different humidity. So we needed more rules. And more rules meant fewer users would agree with all of them at once.

## v7 + v8: six rules, five profiles, instant toggle

v7 ([\`0018ca2\`](#)) added two rule cards we'd been resisting: **cloud cover** and **humidity**. Six rules, all four-in-the-original plus two on the side. We also flipped the default range from 10y to 1m so the landing experience is "today, last week, this month" instead of a ten-year flex. We added Sofia, BG (because the Bilkov family is from Bulgaria) and St. Johns, FL (because Florida-not-Miami is its own conversation).

Six rules made the tool *more* opinionated, not less. So v8 ([\`7e1b3f1\`](#)) admitted defeat and shipped a profile system: five named bundles of rules a user can toggle in one click.

- **Sun Seeker** — strict floor, generous ceiling, low cloud
- **Goldilocks** (default) — the original four-rule comfort target
- **Classic** — the four core rules, no cloud or humidity gates
- **Cool & Cloudy** — high cloud OK, lower temperature floor
- **All-Weather** — the most permissive: daytime + UV-safe, almost everything else passes

The implementation choice that mattered: **per-profile rollups are pre-computed at export time**, not at click time. Every region's monthly bundle ships with parallel columns named \`stay_outside_<id>_hours\` and \`pct_daytime_outside_<id>\` for each profile id. The toggle reads from a different column. Chart, leaderboard, quick-take, and rule cards all re-read against the active profile's column without a re-fetch and without a re-aggregate.

The cost: bundle size grew. The 10-year bundle went from ~2.9 MB to ~5 MB once profiles were baked in. Acceptable. The gain: zero latency on the toggle, zero per-profile API call, zero re-render hitches.

## v9 + v10: another axis, another deep dive

v9 ([\`9a580d9\`](#)) added US AQI as a non-comfort metric — strictly informational, no profile gates against it (yet). At the same time we added Gabrovo, BG, the second Bulgarian region, mostly because the Bay Area / Seattle / Bulgarian-mountain triangle is a comparison that makes me happy.

v10 ([\`668c6fc\`](#)) was the **Region Deep Dive**: every metric, every profile, every grain, on a per-region page. Instead of "compare Bay Area vs. Seattle Eastside on stay-outside hours," you can now drop into San Mateo County and see twelve metrics for that region alone, year-over-year, with the character paragraph at the top. The leaderboard view is for picking *between* places. The deep dive is for understanding *one* place.

This was the inflection point where the tool stopped being a comparison chart and started being a regional almanac.

## v11 + v12: shareable rules, then a custom builder

v11 ([\`37139ae\`](#)) shipped two unrelated quality-of-life things that paired perfectly: **sticky controls** so the toolbar doesn't scroll out of view, and **shareable URLs**. Every UI state — selected regions, active profile, range, grain, metric, drill-in stack — now serializes into the URL. Send a link, the recipient lands on exactly your view. Year-over-year comparisons came along for the ride: lock to one region, walk back through five Aprils.

The shareable URL is the move that unlocked v12 ([\`526ebb2\`](#)): the **Custom Profile Builder**. Users can now define their own rule bundle — pick the temperature range, the UV ceiling, the rain max, optional humidity and cloud caps — and the tool re-runs every region against it. The custom profile encodes into the URL alongside everything else, so a custom rule is a shareable artifact. Send your friend a link to "my idea of nice weather" and they see your nine-region ranking against your definition, not Goldilocks's.

The technical wrinkle: custom profiles can't use pre-computed columns, because we don't know in advance what the user will pick. So the deep-dive panel and chart fall back to client-side scoring — re-aggregating from hourly bundles when the user is on a custom profile. This is slower (a few hundred ms on the 10-year range) but bounded, since the work is local-only and the user opted into it by clicking "build custom."

v12.1 ([\`d6189bd\`](#)) added a six-step product tour for first-time visitors and tightened the share UI for custom rules. By Friday we had a 121-month, nine-region, six-rule, five-prebuilt-or-one-custom-profile dashboard with shareable URLs. It's a lot.

## v13: the editorial reskin

The last move of the week was visual. v13 ([\`4aa780d\`](#)) — "editorial-meteorology reskin" — pulled the design language toward weather-section newsroom rather than dashboard SaaS. Dark glass background, bright county-specific colors over the glass, typographic confidence borrowed more from the New York Times weather page than from a Plotly tutorial. v13.1 and v13.2 followed up by tuning the color saturation on county headers — the original palette was muddy on dark.

Why the reskin: with nine regions, six rules, five prebuilt profiles, and a custom builder, the tool was carrying more state than the old "two charts and a leaderboard" layout could honestly absorb. Editorial design imposes hierarchy. You read the lead first, then the regional cards, then drill into one. The chart is a supporting figure, not the page.

## What I'd do differently

**Profiles should have been v3, not v8.** Every iteration between v3 and v8 — including the second region wave, the AI narratives, the leaderboard, the character profiles — was built against a fixed-rule pipeline I was about to throw out anyway. The pre-computed-column trick wasn't hard to retrofit, but the rule cards, the quick-take template, and the narrative prompts all had to be rewritten once the rule set became dynamic. If your tool is opinionated about a definition, ship the "you might disagree" path before you ship the "and here's why we're right" path.

**Custom profiles should have hourly fallback from day one.** I shipped them with the per-profile-column architecture intact, then realized the next morning that a "custom" profile literally cannot have a pre-computed column. The fallback to client-side scoring was a 90-minute fix on day two. It would've been a 20-minute fix on day zero.

## Try it

[OutdoorHours](/projects/outdoor-hours) now covers nine regions across three continents, six rules, five prebuilt profiles, and a custom profile builder with shareable URLs. Free, no credits, no login.

Build a profile that reflects your idea of nice weather and send me the URL — \`bilko@bilko.run\`. The most opinionated reader's profile gets pinned as a guest preset next week.

If you want to see how the rest of the bilko.run platform fits together, [the full project list is here](/projects). Or for a different tool that takes opinions and gives them back to you sharper, try [PageRoast](/projects/page-roast).

## FAQ

**How do shared profile URLs work?**
Every UI selection — regions, range, grain, metric, profile (built-in id or custom rule object), drill-in stack — encodes into the URL hash. The page reads it on load. No server round-trip; nothing stored on our side.

**Why six rules instead of four?**
Because cloud cover and humidity are the two rules that most often *should* be in someone's definition of comfortable but weren't in ours. Adding them as optional rules (with a \`null\` cap meaning "ignore") preserved the four-rule classic profile while opening up the cloudy-and-cool and humid-and-warm cases.

**Can I add my own region?**
Not directly — adding a region requires fetching ten years of hourly ERA5 data via Open-Meteo, processing it through the export pipeline, and rebuilding the bundles. If there's a county you want covered, email \`bilko@bilko.run\` with the lat/long. The ten regions we have today were added that way.

**Why precompute per-profile rollups instead of scoring at click time?**
Because click latency is the difference between a tool that feels live and a tool that feels like it's loading. The custom-profile path falls back to client-side scoring when the rules are user-defined; built-in profiles read pre-computed columns and stay sub-50ms.`,
    'build-log',
    new Date().toISOString(),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Week-in-review: Apr 28 – May 4, 2026 — Bilko becomes a host platform
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'from-saas-to-host-decomposing-bilko-in-one-week',
    'From SaaS to host: decomposing Bilko in one week',
    'Last week we shipped 1,500+ lines of architecture, deleted 3,156 lines of page code, and added zero features. Here\'s how Bilko stopped pretending to be one product and started being a host for ten of them.',
    `## The week we shipped no features

Last week's git log is four commits and 1,500+ net new lines of code. None of them added a feature. None of them moved a tool's score, fixed a roast line, or reworded a CTA. Every commit was structural — splitting things apart, writing the rules for how the pieces should sit, building the API that lets the pieces move themselves.

That sounds like the worst kind of week to write up. It's actually the most important one Bilko has had since launch.

## Context: ten products in a single bundle

Bilko started with one tool. PageRoast. Then HeadlineGrader. Then eight more. By April there were ten AI tools sharing one Vite bundle, one Fastify server, one deploy. A bug in Stepproof's YAML parser could break PageRoast's build. A redesign of the kit ripped through every tool's page in one commit. Adding the eleventh tool meant rebasing the rest.

The honest read: Bilko was never one product. It's ten products that happen to share a brand, a credit wallet, and a Clerk login. The codebase had been pretending otherwise for a year, and the cost was getting expensive — every shipped change had to think about every other tool.

The week's work was to stop pretending.

## Step 1: Split the server (commit \`63821a7\`)

\`server/routes/demos.ts\` was 2,160 lines and 24 routes. Every AI tool's POST handler, plus the rate limiter, plus the IP-hashing helper, plus the Gemini wrapper, plus a usage tracker — all wedged into one file. We split it into ten per-tool files under \`server/routes/tools/\` and one \`_shared.ts\` for the cross-cutting bits.

The rule we now follow: shared utilities live in \`_shared.ts\`. Tool-specific handlers live in \`tools/<slug>.ts\`. The barrel at \`tools/index.ts\` imports each one and registers it.

This isn't over-engineering. It's the prerequisite for moving any tool out of this repo without touching the others. Without the split, every extraction is a merge conflict against the previous one. With the split, an extraction is \`rm tools/<slug>.ts\` and one line out of the barrel.

The same commit deleted \`src/views/*\` — eight legacy dashboard files from the pre-tool-page era — and killed the \`/app/*\` URL space. Replaced with redirects so old shared links still resolve.

## Step 2: Two pilot extractions

The same commit moved two tools out of the bundle entirely. **OutdoorHours** — a 2,183-line page that had become its own product — went to \`~/Projects/Outdoor-Hours\`. **LocalScore**, the WebGPU-powered private document analyzer, went to \`~/Projects/Local-Score\`. Both now live in their own repos with their own Vite builds, their own slim copies of the kit, and ship as static bundles dropped into \`public/projects/<slug>/\` on the host.

The numbers that mattered: LocalScore alone bundled \`@mlc-ai/web-llm\` at ~2 MB gzipped. That dependency is now zero bytes in the host bundle. OutdoorHours's 2,183 lines of page code dropped to zero. The host's \`vite build\` got measurably faster, and the \`/products\` route hydration stopped paying for code that 90% of visitors never load.

The user-visible URLs didn't change. \`/projects/outdoor-hours/\` is still \`/projects/outdoor-hours/\` — Fastify just serves a different bundle there now.

## Step 3: Write the contract (commit \`faa3b88\`)

Two extractions worked. The third extraction would work too. The ninth wouldn't, because by then the recipe would have drifted three times and nobody would remember which version was right.

So we wrote it down. \`docs/host-contract.md\` codifies the three host kinds:

- \`react-route\` — \`/products/<slug>\`. App lives in this repo, shares Clerk + token wallet in-bundle. Legacy default.
- \`static-path\` — \`/projects/<slug>/\`. App lives in its own repo, drops \`dist/\` into \`public/projects/<slug>/\`. **New default.**
- \`external-url\` — App lives somewhere else.

Plus the URL canonicalization rules, the registry entry shape, the things the host provides each kind, and the things each kind must provide back.

Why a contract beats a convention: the next sibling repo isn't built by me. It's built by a Claude session in that repo's directory, which has never seen the host code. If the rules live only in our heads, the contract drifts. If the rules live in a markdown file the session reads first, the contract holds.

## Step 4: Ship the MCP (same commit)

\`mcp-host-server/\` is a stdio MCP server. Six tools:

- \`get_host_contract\` — returns the contract markdown
- \`list_projects\` — returns the registry
- \`register_static_project\` — adds a registry entry, commits + pushes
- \`unregister_project\` — removes an entry, optionally deletes assets
- \`publish_static_project\` — copies the sibling's \`dist/\` into \`public/projects/<slug>/\`, commits + pushes
- \`status\` — git state + last 5 commits

Sibling-repo Claude sessions wire it via \`.mcp.json\`:

\`\`\`json
{ "mcpServers": { "bilko-host": {
    "command": "node",
    "args": ["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]
}}}
\`\`\`

The sibling never opens the host repo. It calls \`bilko-host__register_static_project\` once, \`bilko-host__publish_static_project\` after every build. The MCP commits to the host's \`origin\` and \`content-grade\` remotes in parallel — failure on one doesn't block the other — and Render auto-deploys within a minute.

This is the part that turns a process into a system. Two extractions by hand was bearable. Nine extractions by hand would be a slog. Nine extractions where each one is "register, build, publish, done" is a Saturday afternoon.

## Step 5: Write the playbooks (commit \`e8d965e\`)

The MCP automates the registration. It doesn't automate the *extraction* — figuring out what each tool imports from the host kit, what tests need to migrate, what server routes stay vs. get deleted, what tailwind tokens the page actually uses. So the last commit was nine per-tool playbooks in \`docs/extractions/\`, ordered by coupling and risk:

1. **Stepproof** (~30 min) — easiest, no auth, no kit
2. **StackAudit** (~60 min) — first Clerk-bundled standalone
3. **LaunchGrader** (~30–45 min) — same shape, SSRF stays server-side
4. **AdScorer** (~90 min) — first "big" one, full kit inline
5. **HeadlineGrader** (~45 min) — kit copy-paste tax bites; publish \`@bilko/host-kit\` here
6. **ThreadGrader** (~30 min)
7. **EmailForge** (~30 min)
8. **AudienceDecoder** (~45 min) — one-time-purchase tier
9. **PageRoast** (~2 hours) — brand flagship, last

Each playbook is the same template — inventory, frontend coupling, backend coupling, test coverage, standalone repo setup, copy-pasteable shell sequence, risks. The template *is* the design. If a tool doesn't fit, that's a signal.

## The Gemini alias fix (commit \`dcb74ca\`)

Earlier in the week, the warm-up: switched the Gemini model from the pinned \`gemini-2.0-flash\` to the auto-rolling \`gemini-flash-latest\` alias. Pinned versions had been getting silently throttled — same model id, longer latencies, no notice. The lesson is small but real: when a vendor ships an auto-rolling alias, use it. Pinning is a foot-gun masquerading as a stability strategy, because "stable" without a deprecation contract just means "frozen in a way the vendor can revoke."

## What I'd do differently

**Ship the MCP first.** We did the two pilot extractions by hand, then wrote the contract, then built the MCP. The second pilot was 3× faster than the first because the recipe was crystallizing. The MCP would have made the first pilot fast too. If you're decomposing a monolith into N siblings, build the publish-pipeline before the first extraction, not after the second.

**The kit will hurt before it gets fixed.** Each extracted sibling carries its own slim copy of the kit (ToolHero, CrossPromo, the colors). After two siblings that's fine. After five siblings it's a copy-paste tax — every brand tweak is a five-repo change. The plan says publish \`@bilko/host-kit\` as a private npm package after the fifth extraction; in retrospect that should have been after the third.

## What's next

This week, Stepproof becomes the first of the nine. Smallest page, no auth, no credits — the lowest-risk way to prove the recipe end-to-end with the new MCP in the loop. Following posts will walk through individual extractions in real time.

If you're interested in how the host platform sits together — three kinds of apps, one home button — both [OutdoorHours](/projects/outdoor-hours) and [LocalScore](/projects/local-score) are reference implementations of the static-path lane. The full project list is at [/projects](/projects). Or if you want a louder demo of what the host's react-route lane still feels like, [PageRoast](/products/page-roast) is the brand flagship — last on the extraction list, exactly because it's the loudest.

## FAQ

**Why not just use a monorepo?**
We will, eventually, in the form of a private npm package for the kit. But monorepos couple deploys: a change in one package can block a release of another. The static-path contract keeps each app's deploy fully independent — the host doesn't redeploy when an app does, and vice versa. That mattered more than the dev-time ergonomics of a single workspace.

**Doesn't every extraction add HTTP latency to API calls?**
Only if the app calls the host API. Free apps like OutdoorHours and LocalScore don't — they're entirely client-side. Apps that do (the upcoming nine) call \`bilko.run/api/...\` from \`bilko.run/projects/<slug>/\`, which is same-origin: zero CORS, zero extra DNS, Clerk's session cookie travels for free. The latency cost is one HTTP round-trip we were already paying inside the bundle as a function call. Real but small; Gemini's 2–8 second response time dwarfs it.

**What if I want to host my own app on bilko.run?**
That's the long bet. The MCP is the API. Read \`docs/host-contract.md\`, build a Vite app with \`base: '/projects/<slug>/'\`, publish via \`bilko-host__publish_static_project\`. Right now the MCP is wired into my own siblings; opening it up to others is a plan-mode question for next quarter.`,
    'build-log',
    new Date().toISOString(),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Week-in-review: May 4 – May 10, 2026 — Six games in seven days
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'week-of-six-games',
    'Six games in seven days — the week our platform became a platform',
    'Eight days ago, bilko.run was a monolith with nine AI marketing tools bolted onto one Vite bundle. Today it hosts twelve apps — six of them games — and the AI tools all live in their own repos.',
    `Eight days ago, bilko.run was a monolith with nine AI marketing tools bolted onto one Vite bundle. Today it hosts twelve apps — six of them games — and the AI tools all live in their own repos. We shipped 118 commits across eight repositories, added 195,546 lines, deleted 12,097, and the most important change wasn't any of those. It was a contract.

This is the story of what we built, in what order, and why the order mattered.

## The starting point: a host that thought it was a product

A week ago Sunday, the Bilko codebase had nine AI tools — PageRoast, HeadlineGrader, AdScorer, ThreadGrader, EmailForge, AudienceDecoder, LaunchGrader, StackAudit, Stepproof — all living as React routes inside the host bundle. Each one had a page, a server route in \`server/routes/tools/\`, and a shared scoring scaffold. They booted together, tested together, deployed together.

That worked when there were three tools. At nine, the bundle was 580 KB gz, the test suite took four minutes, and any change to one tool's UI had to wait for every other tool's CI to pass. Worse: every new app I sketched out — a Sudoku, a Minesweeper, a free AI fundamentals course — had to argue for its place in the same bundle as a SaaS conversion-audit tool. Different audiences. Different cadences. Different everything.

The host had become a product. That's a category error.

## The contract that fixed it: static-path siblings

We'd written \`docs/host-contract.md\` two weeks earlier. The idea: instead of every app being a React route inside Bilko, each app lives in its own sibling repo, builds its own \`dist/\`, and drops it into \`public/projects/<slug>/\`. Bilko's Fastify static handler serves the bundle. The portfolio reads from a registry. URL shape: \`bilko.run/projects/<slug>/\`.

The contract is short. A sibling app must:
1. Emit a \`dist/manifest.json\` with \`slug\`, \`bundle.sizeBytesGz\`, and a list of static assets.
2. Pass a Playwright smoke test against its own preview server.
3. Stay under a 300 KB gz bundle budget (or document a bump in \`KNOWN-ISSUES.md\`).
4. Register itself in \`src/data/standalone-projects.json\`.

That's it. No shared dependency on the host. No coordinated deploys. Each sibling builds in its own Claude Code session, each with its own terminal cursor. The host doesn't know what's inside the bundle and doesn't need to.

This week, that contract earned every word of itself.

## Day 1–2: the great extraction

Before any new app could ship, the nine AI tools had to leave the bundle. We pulled them out one at a time, in roughly half-day cycles each:

- Stepproof → \`~/Projects/Stepproof/\`
- StackAudit → \`~/Projects/Stack-Audit/\`
- AdScorer → \`~/Projects/Ad-Scorer/\`
- LaunchGrader → \`~/Projects/Launch-Grader/\`
- ThreadGrader → \`~/Projects/Thread-Grader/\`
- HeadlineGrader → \`~/Projects/Headline-Grader/\`
- EmailForge → \`~/Projects/Email-Forge/\`
- AudienceDecoder → \`~/Projects/Audience-Decoder/\`
- PageRoast → \`~/Projects/Page-Roast/\`

The migration pattern was the same every time: scaffold a Vite + React + Tailwind v4 sibling, copy the page component, swap the API client to call the same-origin Bilko endpoint via a Clerk JWT, point the build at \`~/Projects/Bilko/public/projects/<slug>/\`, register, push. Each extraction was a self-contained PR. Nine tools, nine PRs, zero coordinated deploys.

The host bundle dropped from 580 KB gz to 287 KB gz — a 50% cut, mostly by deleting nine route components and their per-tool component kits. The test suite dropped from four minutes to ninety seconds, because each tool's tests now lived in its own repo.

## Day 3: extracting the substrate as \`host-kit\`

The extractions exposed something. Each sibling needed the same nine things: a \`<ToolHero>\`, a \`<ScoreCard>\`, a \`<SectionBreakdown>\`, a \`<CompareLayout>\`, a \`<Rewrites>\`, a \`<CrossPromo>\`, telemetry, an event bus, and a manifest emitter. Copy-pasting that into ten repos would mean fixing one CSS bug ten times.

So we extracted \`@bilkobibitkov/host-kit\` as a published npm package. The first published version was 0.3.0 (telemetry only). Three days and eight versions later it was 0.7.2, with \`<GameShell>\`, \`useGameTimer\`, \`useVisibilityPause\`, \`useSaveState\`, \`useLeaderboard\`, \`useUnlocks\`, a typed event bus, the manifest CLI, and a CSS token bundle.

Versioning rule: every published version had a Changeset entry, a CHANGELOG line, and was installed by the next sibling that needed the new feature. No yanking, no force-publishing, no in-place edits to a live release. Boring discipline; pays off the third time you reach for \`npm install\`.

## Day 4: the first game ships, and the platform proves itself

**Sudoku** went live on day four at \`bilko.run/projects/sudoku/\`. Bootstrapped in one PRD, fully implemented in three, drops in a fourth. The first game built using \`host-kit\`'s \`<GameShell>\`. Total bundle: 110 KB gz. Total time from \`pnpm create vite\` to live URL: about six hours of Claude Code session time across two sessions.

Same day: **MindSwiffer**. A clean-room Minesweeper with a no-guess solver constraint — the board generator only ships layouts where pure deduction wins. 65 Playwright tests, five themes (all WCAG AA), reduced-motion support, cascade animations. 89 KB gz. Six hours from bootstrap to publish.

The same day, we wired a **cross-game achievement system**. Finishing a Sudoku puzzle unlocks a "Puzzler" badge in MindSwiffer, and vice versa, via a shared \`useUnlocks\` hook in \`host-kit\`. The bus is a typed \`BroadcastChannel\` wrapper. Two games, talking to each other, hosted in two separate sibling bundles, on the same origin. The contract worked.

## Day 5–6: three retro games in parallel

This is the part that surprised me. Friday afternoon, I asked three Claude Code sessions to research mid-90s mini-games, write extensive PRD chains, and then a fan-out of Sonnet executors built each game end-to-end overnight. They worked in parallel, in three different sibling repos:

- **FizzPop** — bubble shooter, hex-grid snap, BFS cluster pop, daily playfields validated by a deterministic solver. 65 tests. 62 KB gz.
- **Etch** — clean-room Picross/nonogram, 30 hand-curated daily puzzles each verified as uniquely-deductively solvable by a Batenburg–Kosters line solver. 60 tests. 61.65 KB gz.
- **Cellar** — clean-room FreeCell, Microsoft deal-by-number LCG (deal #1 produces JD on top of cascade 1, deal #11982 is correctly identified as unwinnable by the solver). 70 tests. 62 KB gz.

By Saturday morning, all three were committed, tested, and pushed. None of the three games knew the other two existed. The host didn't need to learn any new tricks. We added their cards to \`bilko.run/games\`, and the only host-side change was three lines in \`standalone-projects.json\` per app.

## Day 7: the rename, and what it told us

Today, looking at the npm registry, I noticed the awkwardness: \`@bilkobibitkov/host-kit\`. Five of our eight published packages carried that scope. The bare names were all available — \`host-kit\`, \`page-roast\`, \`webgpu-gemma\`, \`ai-tool-kit\`, \`preflight-license\` — but we'd reflexively scoped them, treating the npm scope as a brand container. It wasn't doing any work.

So we renamed \`host-kit\`. One source-repo edit, one publish, six consumer repos updated and pushed. \`npx page-roast <url>\` is shorter and clearer than \`npx @bilkobibitkov/page-roast <url>\`, and shorter is what \`npx\` is for. Four more renames are queued for the same treatment.

The lesson under the lesson: defaults compound. We scoped reflexively because the first package needed it (we already owned the bare name we wanted on a different package). That reflex shipped through every package after. Six months later, one moment of "wait, why is this scoped" cost us forty-five minutes of git work. Catch the default before it ossifies.

## What we'd do differently

Three things.

**One.** Extract the sibling-bootstrap script earlier. We re-created the same \`vite.config.ts\`, \`tailwind.config.ts\`, \`tsup\` setup, \`manifest.json\` emitter, and Playwright harness for nine apps before realizing we had a template. We finally built the \`bilko-host\` MCP server on day six. It would have saved two days if it existed on day one.

**Two.** Wire Render's deploy webhook before pushing to the master branch the first time. Render auto-deploys from \`Content-Grade/master\`, not \`main\`, and the webhook had been quietly broken for three days. We discovered it the way you usually discover broken webhooks: by waiting for a deploy that never came. A \`RENDER_DEPLOY_HOOK\` env var, curl-able from a PRD, would have unblocked the autonomous overnight build chain.

**Three.** Trust the contract sooner. The first three extractions all had moments of "should this thing live in the host?" The fourth one was friction-free. By the seventh, the question stopped occurring. The host stopped being a product and became a platform somewhere around extraction #5, but I didn't notice until the first game shipped.

## What's next

The Academy lesson backlog. Module 1 (\`what-is-an-ai\`) has six lessons currently shipped as stubs — full frontmatter, valid outline, but no body prose and no interactive components. We've queued seven sequential PRDs for the scheduler to backfill them, each one bringing a lesson up to the quality of the gold-standard L1 (\`what-this-course-is.mdx\`). When that lands, every Academy lesson will have ≥1 of \`<Quiz>\`, \`<Reflect>\`, \`<AskClaude>\`, \`<TokenizerDemo>\`, or \`<DragMatch>\`.

After that, the rename queue: four more \`@bilkobibitkov/*\` packages, one deprecation pass to redirect installs.

If you want to play the games this week's work shipped:
- [Sudoku](/projects/sudoku/) — clean, calm, free
- [MindSwiffer](/projects/mindswiffer/) — Minesweeper, no 50/50s
- [FizzPop](/projects/fizzpop/) — daily bubble shooter, every puzzle solver-validated
- [Etch](/projects/etch/) — clean-room Picross, solvable by thinking
- [Cellar](/projects/cellar/) — FreeCell, every deal solver-verified
- [Boat Shooter](/projects/game-academy/) — work in progress, browser arcade

And if you're curious about the substrate they're built on: [\`host-kit\`](https://www.npmjs.com/package/host-kit) is on npm, MIT-licensed, with a [\`bilko-host\` MCP](https://github.com/StanislavBG/bilko-run/tree/main/mcp-host-server) for sibling-repo authoring. The host contract is at [\`docs/host-contract.md\`](https://github.com/StanislavBG/bilko-run/blob/main/docs/host-contract.md).

## FAQ

**Why six games and not, say, three games done very well?**
Because the contract needed the stress test. One game proves the host can serve a static-path bundle. Three games proves the contract scales. Six games — three of them built in parallel by overnight automation — proves the platform is doing the heavy lifting and the apps are just apps. We learned more about \`host-kit\`'s API in 48 hours of three-game parallel build than in the four days of careful single-app extractions before it.

**How much of this was Claude Code doing the work?**
A lot, structured tightly. Each app had a PRD chain (research → bootstrap → engine → UI → themes/a11y → publish). The PRDs are self-contained; a \`claude -p\` invocation runs each one without conversation context. Three Sonnet executors built FizzPop, Etch, and Cellar in parallel overnight; I reviewed and shipped in the morning. The win isn't "the AI did it" — the win is the contract that let three independent agents work without stepping on each other.

**Are the games actually finished?**
The engines are. Each has solver verification, deterministic seeds, and a test suite. The polish is the next pass — sound design, theme variants, daily-streak persistence across the wallet. None of that is required for the contract; all of it is on the backlog.`,
    'build-log',
    new Date().toISOString(),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Week-in-review: May 11 – May 15, 2026 — Hardening week & the regression discipline
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'all-green-three-bugs-the-regression-pass-caught',
    `Five redesigns, three bugs the "all green" reports missed`,
    'Five Claude Design handoffs. Five implementation agents reported full green tests. A paranoid second-pass regression agent caught three would-have-shipped-broken bugs the green tests missed. This is the post about the gap between "tests pass" and "the thing actually works."',
    `Five Claude Design handoffs landed on Monday. Five implementation agents shipped them, each reporting full green tests. A second-pass regression agent ran behind each one — and caught three bugs that would have shipped broken to production. This is the post about what the green reports didn't say.

If you read [last week's post](/blog/week-of-six-games) — six games in seven days, the host-as-platform pivot, the static-path contract — what you didn't see was what comes after launch week: hardening. This is that. Six polish rounds on Monday, five Claude Design redesigns on Monday afternoon, and the discipline that kept three near-misses out of production.

## One Monday: six polish rounds before noon

Here is Monday's commit timeline, in Pacific Time:

- **00:02** — full-bleed layouts + onboarding tutorials, all five siblings
- **01:13** — v2 polish: 10 visual + UX enhancements per game (themes, win celebrations, microinteractions, daily streak strips, personal stats, settings sheets, synthesized web-audio SFX + haptics, per-game juice)
- **07:39** — round-3 deep features: achievements, PWA installs, replay, custom builders
- **08:17** — round-4 simplicity + smoothness for new players (progressive disclosure for returning users)
- **08:53** — round-5 validated game-state hardening (schema migration, solver verification, deterministic seeds, corrupted-state recovery, formal state machines, multi-tab handling, dev-only diagnostics)
- **12:03** — round-6 framerate + performance: 60fps under every interaction, heavy work moved off the render path, main-thread parse + bundle trim

Each round was a parallel fan-out: one Claude Code session per game, each shipping to its own sibling repo (\`~/Projects/Cellar\`, \`~/Projects/Sudoku\`, \`~/Projects/MindSwiffer\`, \`~/Projects/FizzPop\`, \`~/Projects/Etch\`), with a host-side drop refresh at the end. Five repos times six rounds is thirty self-contained agent invocations in twelve hours. The contract worked. The agents stayed in their lanes. None of them broke another.

This is the part that has stopped surprising me. The interesting part is what happened next.

## The redesign handoffs and the second-pass discipline

Mid-afternoon, five Claude Design handoffs landed — one per game. Real design briefs: visual direction, palette, typography, ambient detail, motion language.

- **Cellar** got a warm wood-cellar treatment — oxblood-and-cream cards, EB Garamond serif, amber lamp glow, italic *Cellar* wordmark, "Cellared." confetti on a win.
- **Sudoku** got paper-first — board fills the viewport via ResizeObserver, auto-notes default flipped to false, a four-button action row, an "N left" pad.
- **MindSwiffer** got Cozy Sweeper — Tearoom/Garden/Parlor palettes, flag-first toggle, "Take it back" 3-undo mine recovery, a generous 7×7 default.
- **FizzPop** got cocoa-and-cream Fuzzy Pop — tilting cannon SVG, dotted aim with wall bounces, a landing-spot ring, color+shape bubbles.
- **Etch** got Sleepy Cat — segmented Fill/Mark-empty pen, tap-and-drag, four palettes, a calm progress bar (no timer), confetti and a cat-color reveal on a win.

Five implementation agents — one per repo — built each redesign. Each reported back: tests green, bundle under budget, drop refreshed.

Then five **independent regression-validation agents** opened the same five repos and ran every relevant test, including the ones the implementation agents didn't think to run.

This is the discipline. It is also the thing that almost wasn't a habit. We added "always pair a redesign with a paranoid follow-up" to the standing rules after this week burned us twice. The cost is one extra agent invocation per redesign. The savings are below.

## Three would-have-shipped-broken bugs

### 1. Cellar's Service Worker stuck on v0.7

Cellar v0.8.0's \`public/sw.js\` shipped with \`const VERSION = 'cellar-v0.7.0'\`. The implementation agent updated \`package.json\`, updated the manifest, updated every component — and left the SW version literal alone. Service Worker invalidation is keyed off that string. Every existing v0.7 PWA user would have stayed on the v0.7 cache forever. The new wood-cellar chrome would have shipped to nobody who had installed the app.

Severity: critical. Fix: bump the literal, add a test that asserts SW VERSION matches \`package.json#version\`. The host-level fix — coming next week — is to template the SW VERSION at build time.

### 2. Sudoku's invisible undo

Sudoku's redesign rewrote \`GridSlot.tsx\` and kept a local \`useState\` board *alongside* the Zustand store. Undo, redo, new-game, multi-tab resume, and cloud-load all dispatched the right events and updated the store correctly. The visible grid never re-rendered.

The existing Cmd+Z test was green because it asserted that the undo *bus event* was dispatched. It was not asserting that the grid actually rolled back. Bus-dispatch is a proxy invariant; visual rollback is the actual one. The test had been wrong since the day it was written; the original implementation just happened to make it look right.

Severity: critical. Fix: \`GridSlot.tsx\` reads from the store directly, \`bus-bridge.ts\` seeds DEV_PUZZLE on first interaction, and the test now asserts the cell text actually changes.

### 3. MindSwiffer's lose-flow test never ran

MindSwiffer's regression agent ran \`pnpm test:unit\` and got a real failure: \`tests/state/store.test.ts\` lose-flow was red. The cozy redesign added a "take-back" mechanic with its own store; \`resetStore()\` resets the main store but not the cozy one. The lose-flow test asserts that resetting a lost game clears all state. The implementation agent had reported "tests pass" — but they hadn't actually run \`test:unit\`. They had run the e2e suite, seen green, and called it.

This is the failure mode that earned its own line in the standing rules: **"all tests pass" reports aren't all the tests**.

## The cross-game patterns worth fixing structurally

The same week's redesigns exposed three patterns that aren't bugs in any one game but will become bugs in every future game if we don't fix them at the host level:

1. **SW VERSION strings hand-maintained.** Templated from \`package.json#version\` at build time, this entire bug class disappears. Filed as a \`host-kit\` task.
2. **Manifest \`gitSha\` drift.** FizzPop and Etch both shipped initial drops with the *previous* version's \`gitSha\` because the build script didn't auto-inject it. The regression agents rebuilt and re-dropped in both cases. The \`manifest\` CLI should always inject \`git rev-parse --short HEAD\` at build time.
3. **"All tests pass" reports aren't all the tests.** Two of five redesign agents reported full green test runs while skipping at least one suite. The host-level guard is to make every sibling's \`pnpm build\` script enforce \`pnpm test:unit && pnpm test:e2e\` as a precondition before \`dist/\` is allowed to land. The implementation agent can still ship — but the build itself will refuse if either suite is red or unrun.

Ten more fix-now items came out of the regression sweep — Cellar's PWA splash flashing white, FizzPop's goal-banner progress bar stuck at 0% from a reference-keyed cache, Etch's tap-and-drag toggling instead of setting, MindSwiffer's cozy mode having no inverse — each one a separate PRD, each one queued to a parallel-group slot in the scheduler.

## What we'd do differently

Make the regression agent the contract, not the convention.

This week the second-pass agent caught real bugs three times. Last week it caught two. The pattern is two months old: any time an agent reports "all tests pass" after a non-trivial structural change, the failure rate of *actual* greenness is somewhere around 30%. Not because the agents lie — because the test surface is bigger than any single fan-out remembers to cover.

The host-side fix is to make the build refuse to produce a \`dist/\` until both unit and e2e suites have run cleanly in the same shell invocation. That's a \`host-kit\` \`prepublish\` hook plus a per-sibling \`package.json\` script. We're shipping it next week. The agent-side fix is already in the playbook: when you ask Claude Code to do a redesign, you also queue the paranoid follow-up. Don't ask, don't assume — queue.

## Calling it a week

That is the post. Six polish rounds Monday, five design handoffs Monday afternoon, three near-misses caught by a paranoid second pass, ten PRDs queued for next week, and a host-level fix planned to make this class of bug structurally impossible.

Taking a few days off. The platform is the platform — it will keep auto-deploying through the rest of the week, the games will keep being playable, the AI tools will keep grading and scoring, and the daily [Outdoor Hours](/projects/outdoor-hours/) snapshot will keep landing on the hour without me. That is the point of the contract.

If you want to see what a Monday of hardening feels like in your browser:

- [Sudoku](/projects/sudoku/) — paper-first, viewport-fill, no spreadsheet vibes
- [MindSwiffer](/projects/mindswiffer/) — Minesweeper in a tearoom, with take-backs
- [FizzPop](/projects/fizzpop/) — daily bubble shooter, cocoa-and-cream chrome
- [Etch](/projects/etch/) — Picross, calm progress bar, sleepy cat reveal
- [Cellar](/projects/cellar/) — FreeCell, wood-cellar chrome, "Cellared." confetti

## FAQ

**Why six polish rounds in a single Monday?**
Because they were independent. Themes, deep features, simplicity for new players, state hardening, framerate — none of those steps blocked any other. Five sibling repos times six rounds is thirty parallel agent invocations; the platform serializes nothing. The bottleneck is review, not invocation, and rounds are a natural review unit: one round, look at the diffs across all five, queue the next.

**Why design handoffs from Claude Design rather than the implementation agent designing?**
Specialization. A redesign handoff written by a design agent — palette, typography, motion, ambient detail — gives the implementation agent a target to *hit*, not a target to *invent*. It's the same reason engineers like specs: the constraint shrinks the search space. The implementation agent doesn't have to defend taste decisions; it just has to land the brief.

**Is the regression-validation agent slowing you down?**
On wall-clock time, yes — it adds about 30% to the redesign cycle. On total time-to-correct-ship, no. The three bugs caught this week would each have cost an evening of debugging once a real user reported the symptom, plus the trust hit of having shipped broken software. The cycle cost is paid in agent time, which is the cheap kind of time.

**What's the host-level fix?**
Two things, both shipping next week. (1) The \`host-kit\` \`prepublish\` hook will refuse to emit a \`dist/\` until \`pnpm test:unit && pnpm test:e2e\` have both completed cleanly. The implementation agent can no longer report "tests pass" without the tests having actually run. (2) The manifest CLI will inject \`gitSha\` and \`version\` from git and \`package.json\` at build time, eliminating two whole classes of drift (the SW VERSION literal and the manifest gitSha staleness).

**Is this an indictment of AI-agent coding?**
No. It's the opposite. The same week that produced three near-misses also produced thirty parallel agent invocations across five sibling repos in twelve hours, with zero broken siblings and a 50% drop in median bundle size for the games over v1. The lesson is not "agents are unreliable." The lesson is that an agent reporting "tests pass" is evidence, not proof — and proof is cheap when the proving agent is also an agent. Pair the work. Trust the pair.`,
    'lessons',
    new Date().toISOString(),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Week-in-review: May 16 – May 22, 2026 — Gather-only Burrow, SST takes over interpretation
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'the-week-the-platform-got-dumber',
    `The week the platform got dumber on purpose`,
    'Last Saturday Burrow scored sentiment on every Reddit post that mentioned a ticker. This Friday it scores nothing. That is not a regression — it is the point. A per-project breakdown of the May 16–22 decoupling: Burrow, SST, the harness, a brand-new Bulgarian guest house repo, and the host that stayed boring.',
    `Last Saturday Burrow scored sentiment on every Reddit post that mentioned a ticker. This Friday it doesn't score anything. That is not a regression. It is the point.

If you read [last week's post](/blog/all-green-three-bugs-the-regression-pass-caught), you already know the host repo barely moved — only the blog seed itself landed in \`Bilko/\` since May 16. That is not the same as a quiet week. The work moved sideways into the siblings, where it belongs: a Reddit pipeline got demoted from analyst to stenographer, a trading research engine inherited everything Reddit used to interpret, the harness we run all of this from grew most of an IDE in six days, and a brand-new sibling opened for a guest house in Bulgaria that does not want any of this energy applied to it.

Here is what actually happened, per project, with the specifics that would be invisible from the homepage.

## Burrow: gather, don't interpret

[Burrow](/projects/burrow) is the Reddit capture pipeline. Until last week it captured posts, dedup'd them, persisted raw bodies — and also classified sentiment, computed pulse coverage, tracked ticker mentions, and exposed all of that derived state through MCP. The problem with that bundle is that **interpretation is not data**. Sentiment for a trader is "is this bull or bear pressure on the stock?" Sentiment for a marketing tool is "is this user happy with the product?" Sentiment for a quant fund is "what is the conviction-weighted edge on this thesis?" Same post, three different answers, and Burrow was picking one of them.

Three PRDs landed this week, all in service of stripping that out.

- **PRD 09 (May 21) — \`track_ticker\` MCP write endpoint.** Consumers can now tell Burrow "make sure pulse is ready for AAPL by 2026-06-30," and a 5-min pipeline drains the queue, scores any already-captured posts that mention the ticker, and transitions queue rows through \`awaiting_capture → in_progress → ready → expired\`. 16 new tests, schema gated on a \`BURROW_MCP_WRITE_TOKEN\`. v1 deliberately ships without targeted Reddit search for tickers with zero existing posts — those wait for binge to surface them organically.
- **PRD 10 (May 21) — Defer sentiment to consumers.** \`sentiment_score.enabled = False\` in the orchestrator registry. The function is preserved as a callable library so a one-off historical re-score still works from the CLI, but no new rows are written. The PRD 07 ticker-mention bypass that we shipped two weeks ago is now a revert. We were wrong; the consumer should own this. 31 tests passing on the new shape.
- **PRD 11 (May 22) — Gather-only Burrow.** The full statement of the policy. Burrow's job is to capture Reddit at human pace, persist raw posts, and expose them through raw MCP endpoints. Ticker extraction, intent counts, mention aggregates, themes, author track records, short-pressure rollups — every one of those belongs in whichever consumer cares. PRD 11 is policy + consumer-migration plan; no Burrow code change yet. SST is the first consumer migrating. After every consumer is off, a follow-up will flip the derived pipelines to \`enabled=False\` and PRDs 03 and 05 get marked superseded.

The honest framing: PRD 07 (May 6) widened the sentiment catchment specifically to feed SST. Two weeks later we reversed it because feeding one consumer is not what a platform pipeline does. The lesson is older than the code — when the right place for a feature is in one specific consumer, putting it in the shared pipeline costs every future consumer and us.

## SST: six phases in six days, suite green at 1023/1027

[Social Signals Trader](/projects/social-signals-trader/) is the consumer that absorbed everything Burrow stopped doing. Forty-three commits since May 16, organized as phases. In order:

- **Phase I (May 17)** — snapshot-data validity test (30 tests pinning \`window.X\` shapes), thread \`now\` through \`GateInputs\` to kill date-drift in the rule engine. Boring, foundational, the kind of work that makes the rest of the week possible.
- **Phase J (May 17–18)** — four small bug-class kills. J1: stop flooding \`TradeProvenanceModal\` with \`market_closed\` rule_breaks (it was the noisiest line in the modal). J2: \`SQUEEZE\` sleeve recognizes Burrow's short-volume schema. J3: populate \`data/options_flow.json\` so the OPT_FLOW panel actually has a panel. J4: retire \`THETA_PREMIUM\` out of the executable sleeve set — it was generating signals but nobody trusted them.
- **Phase L (May 20)** — universe activation, five steps. \`proactive_scan\` activates probes and promotes signals into the thesis lifecycle. OPT_FLOW producer default top-50 → top-200 SP500. \`PORTFOLIO_MAX_OPEN_TOTAL\` default 20 → 30. Earnings cron daily with Yahoo fallback. Per-run coverage row. This is the phase that turned SST from "scans a watchlist" into "scans the universe."
- **Phase M (May 20)** — sleeve activation matrix on the Methodology page, \`top_shorted\` becomes a file-backed producer with file-first preload in \`proactive_scan\`, WSB sleeve probe populates \`topSubreddit\`. Three steps, all in service of "show me which sleeves saw which signal."
- **Phase N (May 20)** — SP500 ∪ NASDAQ-100 as the combined scan universe. \`--extra-universe\` flag on producers so NASDAQ-100 can be piped through cleanly. Two steps. Cheap.
- **Phase O (May 20)** — penny watchlist. \`scan_penny_universe\` runs in parallel with the main scan. The whole phase was "expand without slowing down the hot path." Two steps.
- **Phase R (May 21)** — sentiment classification consumer-side. The mirror of Burrow PRD 10. SST now has its own \`sentiment_scorer\` + \`sentiment_cache\` + \`score_tickers\` loop that reads raw posts from Burrow via \`reddit_mcp.posts_for_ticker\`. The classification logic that used to live in Burrow is now in SST, but tuned for trading semantics specifically — bull/bear/neutral with conviction weighting, not generic sentiment.
- **Phase S (May 21–22)** — SST owns extraction + caching + aggregates. The mirror of Burrow PRD 11. SST's ticker extractor + local cache verified (S1). \`fetch-posts\` drains \`hot_posts\` + \`dd_posts\` into a local \`post_cache\` (S2). Local \`aggregates\` computes \`mentions_count\`, \`velocity\`, \`top_subreddit\` per ticker (S3). \`proactive_scan\` reads those from the local cache instead of MCP-roundtripping Burrow on every tick (S4). Phase closed (S5) with the full suite green at **1023 pass / 1027** — the four failures are pre-existing and tracked separately.

The thing that is easy to miss: SST is now a more complete consumer of Burrow than Burrow was of itself. The bundle of "raw data + interpretation" lived inside Burrow as a leaky abstraction; pulled apart, SST owns about 60% of the lines that used to be in Burrow, and Burrow lost about 30% of its surface area. Neither service is smaller in code lines — but the boundary now matches the actual contract.

## session-manager: from v0.10.0 to v0.12.1 in six days

[session-manager](/projects/session-manager) is the Claude Code session harness we run everything else from — the TUI/Electron app with the tab bar, the agent inspector, the scheduler queue, the cockpit. It got an order of magnitude more attention this week than any of the products it manages.

The unifying move was a port from \`ClaudeCodeUnleashed\` (a community Electron harness with a more mature IDE-ish UI). The pace was real:

- **v0.10.0 (May 16)** — consolidation pass + Cmd-K / CSP / agent-view bug fixes.
- **v0.10.1 (May 17)** — Mac startup detection, real \`/usage\` everywhere, cockpit refactor.
- **v0.10.2 (May 18)** — Ctrl+V image paste, drop the AppStatusBar/TabBar "new" button, Alt+1..5 tab shortcuts.
- **v0.10.3 (May 21)** — Doc Editor lands (Tiptap, not Monaco — the editor for prose and markdown lives separately from the editor for code), agent-view cleanup, scheduler hardening.
- **v0.10.4 (May 21)** — left-nav section separators. Cosmetic but the nav was getting busy enough to need them.
- **v0.10.5 (May 22)** — Terminal clickable URLs + file paths, native context menu, smart Ctrl-C.
- **v0.11.0 (May 22)** — 12-feature port from Unleashed (Wave 1+2+3a+3f+4): GitActions, DeployMenu, NotificationCenter, plus nine others. This is the release that adopted the Unleashed Header + modals nav pattern across the harness.
- **v0.11.1 (May 22)** — FileTree sidebar (Cmd+B) + first-run TourOverlay.
- **v0.12.0 (May 22)** — Orchestrator (multi-pty parallel task dispatch), GlobalSearch, QuickOpen, RepoVisualization, Activity section on the overview page (7d/30d cuts, hourly/daily, top projects).
- **v0.12.1 (May 22)** — Hives: pre-baked agent swarm templates. The slot pattern from \`scheduled-plans/prds/NN-*.md\` generalized into reusable templates you can drop into a project.

Eleven releases in six days for a tool that we use every day to ship the rest of the tools. The risk is real — every release of session-manager is a release of the thing we use to release everything else, so a bad release of the harness costs more than a bad release of any single sibling. So far no rollbacks; one e2e suite fix landed mid-cycle (\`doc-editor sub-tab selector excludes close buttons\`). The bet is that the IDE-ish surface (FileTree + Orchestrator + GlobalSearch + QuickOpen) is going to compound for as long as we keep building sibling repos.

## torlashka-sreshta: a new sibling, deliberately slow

A new repo opened on May 21: \`~/Projects/torlashka-sreshta/\` — marketing site + booking API scaffold for a small guest house in Bulgaria. Three commits so far: initial scaffold, hamburger menu for mobile nav, and "proposal 0003 — tracking and API request logging." The interesting thing about this repo is the rule it shipped with on day one:

> **No DB tables, columns, indexes, or API endpoints get written as code until the corresponding spec is approved.** Propose changes as a markdown doc under \`docs/proposals/NNNN-<slug>.md\`. Include motivation, DDL (SQL), endpoint signatures, open questions. Wait for explicit approval in chat. Only then write migrations, route handlers, or types.

That is the exact opposite of how the games shipped (PRD-chained, parallel fan-out, agent-graded) and the exact opposite of how SST runs (six phases in six days). And it is deliberate. The Bulgarian guest house has one owner, one season, one set of guests; the SaaS pace would be ridiculous for it. The proposal-gate is the speed limit, and the speed limit is the feature.

This is the model for any future sibling that wants to be a service business and not a SaaS — torlashka-sreshta is the template. The host doesn't care; static-path siblings can ship at any pace they like, and the manifest contract treats a hand-built artisan site the same way it treats a 1023-test trading engine.

## The host stayed boring

The Bilko host repo itself moved exactly twice this week: the [previous blog post seed](/blog/all-green-three-bugs-the-regression-pass-caught), and an Etch v0.8.2 redesign refresh sitting uncommitted in the working tree as I write this. Every other diff in the repo is the cron pipeline doing its job — \`social-signals-trader: publish dashboard snapshot 2026-05-22T*\` every thirty minutes, \`OutdoorHours\` daily JSON refreshes. The dashboard snapshots alone account for ~180 commits in the week. That is not noise; it is the heartbeat of the platform working without me.

The point of the static-path contract is that the host doesn't have to change for the siblings to ship. This week was the cleanest evidence of that yet — five repos shipped real work, two architectural decouplings landed, a brand new sibling opened, and the host's own commit log was a flat line punctuated by the auto-deploy webhook firing on schedule.

## What we'd do differently

Two things.

**The Burrow decoupling could have happened in week three, not week ten.** The moment SST needed sentiment to be tuned for trading semantics (early April), the right move was to write the interpretation in SST and let Burrow stay raw. Instead we widened the Burrow pipeline (PRD 07), then reverted it (PRD 10), then wrote the policy doc (PRD 11). That is three rounds of work to land at the design we could have started with. The cost of that round-trip is real but bounded — the Burrow → SST migration is mechanical now because the test suites pinned the contract. If we'd never written PRD 07 we'd have had less evidence that the boundary was wrong. So: not a regret, but a tax we'd skip next time.

**The harness port was ambitious.** Eleven releases in six days, on the tool we use to ship every other tool. The thing that kept us out of trouble was that the underlying scheduler/queue/agent-view code didn't change — what changed was the chrome around them. We should still expect a hardening week for session-manager, because eleven releases compounded means eleven release-notes worth of small edges that haven't all been hit yet. Queueing a paranoid follow-up agent on the harness itself is now on the docket.

## Calling it a week

That is the post. Burrow gathers. SST interprets. The harness grew an IDE. A guest house in Bulgaria opened its own repo with a proposal-gate rule. The host did nothing except let the cron run.

If you want to poke at any of the surfaces:

- [Outdoor Hours](/projects/outdoor-hours/) — the daily heartbeat
- [Stack Audit](/projects/stack-audit/) — older but still grading SaaS bloat
- [Page Roast](/projects/page-roast/) — the savage CRO audit tool
- The [/projects](/projects) gallery — every sibling, current status

## FAQ

**Why pull sentiment out of Burrow if SST is the only consumer right now?**
Because the moment we wrote the second consumer, the cost of pulling it out would be 2× higher, not 1×. The right time to decouple is when there is exactly one consumer using a leaky abstraction — because the test surface is small enough to migrate cleanly, and the cost of being wrong is one rewrite. Decoupling at three consumers means three rewrites and a coordination problem.

**Is the harness port (session-manager v0.10 → v0.12) risky for the day-to-day Claude Code workflow?**
Yes, structurally. Eleven releases of the thing we run every other tool from is more change than we'd ship in any single product repo. The mitigation is that session-manager's release contract is the same as every sibling's: \`pnpm test:unit && pnpm test:e2e\` are preconditions, and a regression-validation agent runs behind every non-trivial structural change. We've taken one e2e fix mid-cycle so far; if a v0.12.x dot-release shows up next week, it'll be because something compounded that the agent didn't catch.

**Why does torlashka-sreshta have a manual review gate when every other sibling is agent-fan-out?**
Because the speed limit is the feature. A guest house booking site has one owner, a finite number of rooms, and one season's worth of guests. The cost of a wrong schema migration on production is one phone call from a confused booking. The proposal-gate matches the actual blast radius of the system. The same gate on SST would slow it to 5% of its current pace; the same fan-out on the guest house would land us with a payments table nobody asked for.

**What is the actual contract Burrow exposes now?**
Read MCP endpoints: \`reddit_mcp.posts_for_ticker\`, \`reddit_mcp.recent_posts\`, raw post bodies + metadata. Write MCP endpoint: \`track_ticker\` (gated on \`BURROW_MCP_WRITE_TOKEN\`) for calendar-driven backfill — "make sure pulse is ready for X by deadline Y." Everything else — extraction, interpretation, aggregation, sentiment — moved to the consumer. After every consumer migrates, the derived-pipeline rows in the orchestrator registry flip to \`enabled=False\` and the deprecated PRDs (03, 05) get final superseded banners.

**Is the host repo going to stay boring?**
For as long as the static-path contract holds, yes. The host's job is to provide brand chrome (Layout, HomePage, ProjectsPage, BlogPage, PricingPage, AdminPage), shared auth (Clerk), shared credits (Stripe), shared analytics, and the manifest/static-serve plumbing. None of those things should need to change just because a sibling shipped a new feature. The week the host stops being boring is the week a sibling needs something the contract doesn't cover — and that has not happened since the decomposition in early April.`,
    'lessons',
    new Date().toISOString(),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Build log: Burrow goes gather-only (May 22 – June 3, 2026)
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'burrow-goes-gather-only',
    `Burrow goes gather-only: a pipeline that won't interpret`,
    'Burrow used to capture Reddit posts and score their sentiment. This week it stopped scoring — on purpose. PRD 79 dropped post_sentiment, PRD 80 put a single Reader between the dashboard and the indexer, EDGAR moved out to its own repo, and a pile of unglamorous fixes kept the crawler alive. The case for a data pipeline that refuses to have an opinion.',
    `Burrow is the part of my stack that watches Reddit. For months it did two jobs: capture posts at human pace and persist them raw, *and* score each one — sentiment, ticker mentions, pulse coverage — exposing all of that derived state over MCP. This week I cut the second job out entirely. Burrow now gathers and serves raw data, and nothing else.

That sounds like a downgrade. It is the opposite. Here is why a data pipeline should refuse to interpret, and the PRDs that made Burrow refuse.

## Why a pipeline shouldn't have an opinion

"Sentiment" is not a property of a Reddit post. It is a question someone asks of a post, and the right answer depends on who is asking. A trader wants "is this bullish or bearish pressure on the stock?" A marketing tool wants "is this user happy with the product?" A quant wants "what is the conviction-weighted edge on this thesis?" Same post, three different answers. When Burrow scored sentiment, it was silently picking one of those answers for everybody — and getting it wrong for almost everybody.

The fix is to push interpretation to the consumer and keep the pipeline honest: capture, dedupe, persist, expose. If a consumer wants sentiment, it reads the raw posts and scores them with its own definition. Burrow's job is to make sure the raw posts are there, fresh, and addressable.

## PRD 79: drop sentiment, add research-on-demand

PRD 79 was the cut. \`post_sentiment\` is gone and the scoring pipeline is archived — not deleted, archived, so a historical re-score can still run as a one-off, but no new derived rows get written. In its place Burrow grew something far more useful: a research-on-demand pipeline. \`analytics.db\` migrated to schema version 10 with a \`research_requests\` queue table; a HIVE-agent research worker drains that queue and writes into a lazily-created \`knowledge_adhoc\` Chroma collection; and four new MCP tools — \`request_research\`, \`research_status\`, \`research_results\`, \`search_adhoc\` — let a consumer say "go find out about X" and poll for the answer. Burrow stopped having opinions about posts and started taking orders for research instead.

## PRD 80: one Reader, one contract

The dashboard used to import the indexer directly and read its internals. That is the kind of coupling that makes every refactor a landmine. PRD 80 introduced a single shared \`Reader\` singleton — one object that owns every read path — and routed the dashboard's research route through it instead of the indexer. Then it enforced a loopback-only bind, added an import-check, and wrote the Contract surface docs so the boundary is something you can point at, not folklore. Three parts, one outcome: there is now exactly one way to read from Burrow, and it is documented.

## The hardening nobody sees

A crawler that runs unattended fails in boring, fatal ways, and a chunk of the week went to those:

- **Stop OOM-killing the orchestrator.** The indexer was holding too much in memory under pressure and taking the whole orchestrator down with it. Fixed the memory profile so a backfill can't nuke the process.
- **Auto-recover a crashed renderer.** The browser layer now detects a dead renderer, restarts it, and surfaces an honest health signal instead of silently wedging.
- **Real HTTP 410 for tombstones.** Deleted resources used to return \`200\` with an error envelope — which every client read as success. They now return a real \`410 Gone\`, so a consumer can tell "deleted" from "broken."
- **Ticker-aware subreddit discovery (PRD 81).** Targeted gather: Burrow can now discover and prioritize the subreddits where a given ticker actually gets discussed, instead of crawling blind.

None of these ship a feature anyone will tweet about. All of them are the difference between a pipeline you trust unattended and one you babysit.

## EDGAR moved out

Burrow had also been ingesting SEC EDGAR filings. That never belonged here — it is a different data source with a different cadence and a different consumer — so it moved to its own repo (edgar-rag), and Burrow's \`news_collect\` pipeline got disabled in the registry. A pipeline that refuses to interpret should also refuse to sprawl. One source, done well, beats three sources done partway.

## What I'd do differently

I'd have drawn the gather/interpret line at the start. Burrow shipped with sentiment baked in because, early on, there was exactly one consumer and baking it in was faster. The moment a second consumer showed up with a different definition of "sentiment," the bundle became a liability — and I still waited weeks to cut it. The lesson: the first time you catch yourself picking a default *meaning* for downstream consumers, that meaning belongs downstream. A pipeline's superpower is that it has no opinion; spend it.

## See it / build on it

- [Burrow on GitHub](https://github.com/StanislavBG/burrow) — the gather-only pipeline + MCP surface
- [How the gather-only bet started](/blog/the-week-the-platform-got-dumber) — the previous build log
- [social-signals-trader](/projects/social-signals-trader/) — the first consumer that now owns its own interpretation

## FAQ

**Doesn't removing sentiment make Burrow less useful?**
It makes it *more* reusable. A pipeline that scores sentiment is useful to exactly the one consumer whose definition of sentiment it happened to encode. A pipeline that serves clean raw posts plus on-demand research is useful to every consumer, because each brings its own definition. Less opinion, more reach.

**What's the research-on-demand pipeline for?**
It turns Burrow from a passive capture loop into something you can task. A consumer enqueues a research request, a HIVE-agent worker investigates and writes results into an ad-hoc knowledge collection, and the consumer polls for the answer over MCP. It is the gather-only philosophy taken one step further: Burrow doesn't interpret your data, but it will go *get* data you ask for.

**Why a single Reader instead of just importing the indexer?**
Because "just import the indexer" is how every internal becomes load-bearing. One Reader singleton means one read contract, one place to enforce loopback binding and import rules, and one thing to document. The dashboard no longer knows the indexer exists — it knows the Reader exists. That is the whole point of a boundary.`,
    'build-log',
    '2026-06-03T16:00:00.000Z',
  );

  // ─────────────────────────────────────────────────────────────────────
  // Build log: signal-builder — m0 to M9 and the cycle (May 22 – June 3, 2026)
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'signal-builder-m0-to-m9',
    `signal-builder: m0 to M9, and the cycle that redefined it`,
    'In two days a brand-new repo absorbed an entire trading engine\'s interpretation layer — nine milestones, m0 through M9. Then an architecture audit caught it importing its own client. Breaking that dependency cycle turned signal-builder from a helper library into a hosted, paid, multi-tenant MCP service. A build log about the difference.',
    `signal-builder did not exist two weeks ago. This week it went from an empty m0 skeleton to M9 — nine milestones — and absorbed the entire interpretation layer of my trading stack. Then I almost shipped it broken, caught it in an architecture audit, and the fix changed what signal-builder *is*. This is that story.

## Nine milestones in two days

The plan: [Burrow](https://github.com/StanislavBG/burrow) gathers raw Reddit, [social-signals-trader](/projects/social-signals-trader/) trades, and signal-builder sits in the middle turning raw posts into structured, trader-facing panels. Each milestone moved one piece of interpretation out of the trader and into the new service:

- **m0** — skeleton, \`PanelStore\`, a \`panels.health\` stub.
- **M1** — \`aggregates_local\` + \`post_cache\` + eight panel/signal MCP tools.
- **M2** — the sentiment stack, behind \`panels.sentiment\`.
- **M3** — news stack + \`panels.news_signals\` + short-interest.
- **M4** — \`fund_extractor\` (10-K/10-Q thesis extraction) + \`panels.fund_theses\`.
- **M5** — \`catalyst_calendar\` + \`panels.catalyst_calendar/find\`.
- **M6** — \`proactive_scan\` + \`score_tickers\` + corroboration.
- **M8** — \`meta.panel_history\` + \`meta.panel_freshness\`.

The trader, in parallel, replaced each of those with a thin shim delegating to the \`signal_builder\` package. On paper it was a clean three-layer split, done in a weekend.

## The cycle: a service that imported its client

Then I ran a full architecture audit, and it flagged the split as half-finished: an undeclared dependency reached via both an editable import *and* a spawned MCP, with no enforced contract. Translation: signal-builder's M6 modules — \`proactive_scan\`, \`score_tickers\`, corroboration — were importing \`social_signals_trader.strategies\`, \`.events\`, \`.theses\`, \`.universe\`.

The upstream producer was importing the downstream consumer. That is a dependency **cycle**, and it is fatal to the thing I wanted signal-builder to be. The tell was deployment: I could not run signal-builder anywhere the trader wasn't also installed. A service you can't start without its own client is a library in a costume.

## The fix, and the rule it taught

The fix was four commits, all "move it back." \`proactive_scan\`, \`score_tickers\`, corroboration, and \`catalyst_calendar\` went home to the trader. The rule that fell out, and that I should have started with:

> A module that imports the trader's strategies, events, or theses *is* trader orchestration — it lives in the trader. A module that produces per-ticker data from raw inputs — sentiment, news, fund theses, aggregates — is genuinely upstream, and it stays in signal-builder.

After the cut, no real \`social_signals_trader\` import remained in \`src/signal_builder\`. 337 tests pass. The producer no longer knows the consumer exists. \`score_tickers\` was simply deleted — it was never an MCP tool and nothing in signal-builder imported it; \`proactive_scan\`'s only real use was resolving a coverage-ledger path, which got inlined behind an env var. The panel still reads the ledger; the scan that writes it is the trader's job.

## From library to product

Here is what the cycle was hiding. Once signal-builder couldn't import the trader, the question "where does it live?" had a new answer — not a package, a service. The decision, written into the architecture doc:

> signal-builder is a separate, publicly-hosted, paid, multi-tenant MCP service producing per-ticker time-series; this trader is its first of many clients.

A client-only dependency, contract-pinned, that degrades gracefully when the service is down. Two pieces of plumbing made the boundary real this week: a \`ticker_tracker\` queue + drainer (PRD 54, closing an old exception) so consumers can request coverage for a ticker, and a Burrow ↔ signal-builder integration smoke battery (PRD 58) that exercises the Burrow MCP directly and flags the HTTP middleware gap. It even grew a \`panels.edgar_signal\` tool (PRD 82) deriving insider + 8-K tone from EDGAR. signal-builder stopped being "the trader's helper" and started being a product the trader rents.

## What I'd do differently

Check the import direction before moving code, not after. The audit caught the cycle, but the signal was visible on day one: \`proactive_scan\` imports strategies and theses, which are trader concepts. One question — "which way do this module's imports point?" — asked before M6, and the whole extract-then-reverse round trip never happens. The thing that saved me was test coverage: 337 tests on signal-builder and a thousand-plus on the trader meant the reversal was mechanical, not terrifying. Extract aggressively if your tests pin the contract — but read the arrows first.

## See it / build on it

- [signal-builder on GitHub](https://github.com/StanislavBG/signal-builder)
- [social-signals-trader](/projects/social-signals-trader/) — its first client, and where the orchestration went back to
- [Burrow](https://github.com/StanislavBG/burrow) — the raw-posts producer it sits on top of

## FAQ

**Why build signal-builder at all instead of leaving the logic in the trader?**
Because interpretation is consumer-specific and the trader won't be the only consumer. Pulling sentiment, news, and fund-thesis extraction into a producer that exposes per-ticker panels over MCP means the next consumer — another strategy, a research tool, a dashboard — reads the same panels instead of reimplementing them. The split is what lets the producer become a paid service with many clients.

**Was extracting nine milestones in two days reckless?**
Half of it was right and half overshot. The data-producing milestones (M1–M5) belonged in signal-builder and stayed. The orchestration milestone (M6) imported the trader and had to come back. The recklessness wasn't the speed — it was not checking the dependency direction per milestone. With the test suites pinning both sides, fixing the overshoot cost four commits.

**What does "multi-tenant paid MCP service" actually mean here?**
signal-builder will be hosted once, produce per-ticker time-series, and serve many clients over MCP — billed per use, isolated per tenant. The trader depends on it as a remote service (client-only, contract-pinned) and keeps trading even when the service is unreachable, just with staler signals. That contract is only possible because the producer no longer imports any one client.`,
    'build-log',
    '2026-06-03T16:30:00.000Z',
  );

  // ─────────────────────────────────────────────────────────────────────
  // Build log: social-signals-trader — extract and reclaim (May 22 – June 3, 2026)
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'trader-extract-and-reclaim',
    `I extracted my trader's brain, then took half of it back`,
    'social-signals-trader shimmed its entire signal layer out to a new service, shipped a 3-tier CATALYST_WATERFALL strategy and a strategy-catalog-as-data system, enabled shorts and flat $5k tickets — then reclaimed its orchestration when the split turned into a dependency cycle. A build log about where a trading engine\'s brain actually belongs.',
    `social-signals-trader is the engine that turns signals into trades. This week it did two contradictory-sounding things: it gave away its entire interpretation layer to a new service, and then it took the orchestration half of that layer right back. Both were correct. Here's the build log, including the strategy work that happened in between.

## CATALYST_WATERFALL: a three-tier cascade, as data

The headline feature is a single strategy that fires on every catalyst-calendar thesis and walks three signal tiers — first to produce a direction wins:

1. **social** — \`panels.sentiment\`, gated on bull-share — at 1.0× capital
2. **options_tech** — call/put ratio with an above-50-day-SMA fallback — at 0.5× capital
3. **naive** — constant LONG — at 0.25× capital

The clever part is that it's all data, not code. The variant DSL gained a \`cascade:\` key; each tier either declares a full signal spec or a constant \`direction_rule\` shortcut. Every emitted proposal carries its \`tier\` and \`capital_multiplier\`, so the audit log preserves *why* a trade fired, and the dashboard's Trades table renders a coloured tier badge — green for social, amber for options_tech, grey for naive — by joining audit rows onto orders by \`client_order_id\`. You can read a fill and know which tier of conviction produced it.

## Strategy catalog as data (no code to add a sleeve)

CATALYST_WATERFALL rides on a bigger change: the strategy registry is now built from \`data/strategies/*.yaml\` (PRD 70), a strategy variant can be declared entirely in YAML with no code change (PRD 71), and a variant-evaluation harness (PRD 72) lets me A/B a new sleeve before promoting it. Adding a strategy went from "write a class, wire it in, test it" to "drop a YAML file." That is the difference between a trading engine I extend and a trading engine that fights me.

## Shorts, flat tickets, and Alpaca-vs-SPY

A run of smaller decisions that each removed a fudge factor:

- **Shorts enabled end-to-end** (PRD 60) — the engine can now express bearish theses, not just sit them out.
- **Flat $5,000 ticket notional** promoted from an env-only override to the default, and the CATALYST_WATERFALL tiers flattened to 1.0× — every trade is the same size regardless of tier. Position sizing was adding noise to strategy evaluation; making it flat made the comparisons honest.
- **Alpaca-vs-SPY as the primary KPI** (PRD 73) — the dashboard's headline number is now performance against the index, because beating SPY is the only benchmark that matters. Also shipped: an Optimization tab (PRD 47) for sleeve param sweeps and a Signals tab (PRD 46) with sentiment/mentions time-series, plus \`trade_points\`, a daily OHLCV collector over the event-relative window so backtests have clean price data.

## The shims, the audit, and the reclaim

Mid-week the trader shimmed its whole signal layer out to the new [signal-builder](https://github.com/StanislavBG/signal-builder) service — sentiment, news, fund_extractor, catalyst_calendar, proactive_scan, all delegating to the package (M2–M8). Clean on paper.

Then an architecture audit told the truth: the split was half-finished. signal-builder's orchestration modules were importing the trader's own strategies, events, and theses — a dependency cycle dressed up as a layer. The audit also flagged three overlapping decision engines (the agent path was ~41% rate-limited), dual order submitters with no shared lock, and a 605 MB unbounded data file. The signal split was the load-bearing one.

So I reclaimed it. \`score_tickers\`, \`proactive_scan\`, corroboration, and \`catalyst_calendar\` moved back into the trader, because anything that imports strategies/events/theses *is* trader orchestration. What stayed in signal-builder is what's genuinely upstream — the per-ticker data production. The trader now talks to signal-builder through a single \`sb_client\` gateway with a pluggable transport: a client-only dependency on a remote service, not an editable import of a sibling package.

## What I'd do differently

I'd separate "what data do I consume" from "what decisions do I make" before extracting anything. The mistake wasn't building signal-builder — it was moving the decision-making (\`proactive_scan\`, \`score_tickers\`) into it alongside the data production. Decisions need the trader's strategy context; data production doesn't. Drawing that line first would have made the split a one-way move instead of a round trip. The reclaim was cheap only because the test suite held the contract on both ends.

## See it / build on it

- [social-signals-trader](/projects/social-signals-trader/) — live dashboard, Alpaca-vs-SPY up top
- [signal-builder](https://github.com/StanislavBG/signal-builder) — the producer the trader now rents from
- [The cycle, from signal-builder's side](/blog/signal-builder-m0-to-m9)

## FAQ

**Why flatten every trade to $5,000?**
Because variable position sizing was contaminating strategy evaluation. If a sleeve looks good, I need to know it's the *signal* that's good, not that it happened to size up the winners. Flat tickets make the comparison between strategies and tiers honest; sizing is a separate optimization I can add back once the strategies are proven.

**Isn't strategy-as-YAML just config sprawl?**
It would be if the YAML were doing logic. It isn't — it declares which signals a sleeve uses and how they cascade, against a fixed set of evaluators. The logic lives in code; the *composition* lives in data. That split is exactly what lets me add a sleeve or A/B a variant without a deploy, and it's why CATALYST_WATERFALL's three-tier cascade is a single YAML file.

**Why take the orchestration back instead of fixing signal-builder to not need the trader?**
Because the orchestration genuinely needs the trader. \`proactive_scan\` probes the trader's strategy deciders and promotes results into the trader's thesis lifecycle — that's trader logic by definition. The right boundary isn't "make the producer smart enough to do it"; it's "the producer produces data, the trader decides." Moving it back put the code where its dependencies already pointed.`,
    'build-log',
    '2026-06-03T17:00:00.000Z',
  );

  // ─────────────────────────────────────────────────────────────────────
  // Build log: MCP-Host — the iStore for MCPs (May 29 – June 3, 2026)
  // ─────────────────────────────────────────────────────────────────────
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'mcp-host-istore-for-mcps',
    `MCP-Host: building the iStore for MCP servers`,
    'Once two of my projects turned into hosted paid MCP services, they needed somewhere to live that solved auth, billing, and tenancy once instead of per repo. MCP-Host is that — a single gateway mounting every provider at /mcp/<provider>, sharing OAuth 2.1, one x402 wallet, and per-provider Postgres RLS. From "initial platform" to self-serve publish in six days.',
    `This week two of my projects — [signal-builder](https://github.com/StanislavBG/signal-builder) and edgar-rag — stopped being internal libraries and became hosted, paid MCP services. The moment that happened, they both needed the same boring things: authentication, billing, per-tenant data isolation, metering, a public registry entry. Building that once per repo is how you end up maintaining three half-baked auth layers. So I built it once. MCP-Host is the result — a single control plane, runtime, and storefront for a whole fleet of MCP servers.

## One gateway, every provider

MCP-Host is one Replit-hosted FastAPI app that mounts every provider at \`/mcp/<provider>\`. A request flows through a single pipeline — auth → entitlement → billing → dispatch → metering — before it ever reaches provider code. That means a provider author writes tools, not infrastructure: the gateway handles the OAuth handshake, checks the caller's entitlement, debits the wallet, routes to the tool, and records usage. Add a provider, and it inherits the entire pipeline for free.

The three pilots wired in this week are real, not toy: edgar-rag (SEC filings), signal-builder (trading signals), and the social-trader — three providers from completely disconnected disciplines, sharing one gateway.

## The Provider Protocol

What keeps this from becoming a pile of special cases is a contract. A provider conforms to the Provider Protocol: a \`provider.json\` manifest plus an SDK \`Provider\` base class with \`@tool\` decorators, a \`ToolContext\`, typed \`ErrorCode\`s, content helpers, and a manifest validator. There's a CLI — \`mcp-host scaffold / validate / tdqs / syndicate\` — that generates a new provider skeleton, validates the manifest, runs it through a quality gate (TDQS), and plans registry syndication. The protocol is the thing that lets "onboard a new MCP" be a documented checklist instead of a negotiation.

## Auth, billing, and tenancy — solved once

The shared services are the whole value proposition:

- **Auth** — OAuth 2.1-style token + API-key validation, plus an entitlement engine that decides who can call what.
- **Billing** — one shared x402 wallet, a per-tool price map, fail-closed by default, with an admin bypass for testing. Every provider bills through the same wallet.
- **Data** — a per-provider Postgres layer with Row-Level Security schemas, so two providers (or two tenants of one provider) can never read each other's rows. In dev it's a \`SqliteStore\` with a \`TenantDB\`; in prod a \`PgStore\` with RLS; a factory picks the backend off \`DATABASE_URL\`.
- **Artifacts** — an HMAC chunked-upload store with a read-only view, for providers that serve files.

Phase 2 this week added per-MCP owner-admin isolation and a publisher MCP with owner-gated upload — so a provider's owner administers their own MCP without touching anyone else's. 81 tests across all of it.

## Six days: v0.2 to self-serve v0.4

The pace tells the story. It went from "initial platform" on May 29 to self-serve in six days:

- **v0.2.0** (Jun 2) — first real provider (platform-health), DB-degraded resilience, version + live git short-SHA in \`/health\`.
- **v0.2.1–v0.2.2** (Jun 2) — a storefront with a status dot, a version/build/backend/provider-count header, and live \`/health\` results embedded on the homepage.
- **v0.3.0** (Jun 3) — live owner ingest for the social-trader.
- **v0.4.0** (Jun 3) — the big one: self-serve register, publish, and a declarative proxy, so a provider can be added without hand-editing the host.

Along the way it grew a production Postgres backend (PgStore + per-provider RLS, auto-selected by \`DATABASE_URL\`) and Replit first-boot hardening — a Reserved-VM target, a preflight config guard, and a \`PgStore\` that retries connect with backoff so a cold database can't abort boot. The unglamorous deploy-reality work is exactly what makes a control plane trustworthy.

## What I'd do differently

I'd have written the Provider Protocol before the first provider, not alongside the second. MCP-Host only exists because I noticed signal-builder and edgar-rag needed the same scaffolding — but I noticed it *after* both had started growing their own. A little of that work was thrown away. The general lesson: the second time you build the same plumbing, stop and extract it; the third time, you've already lost. Two providers in one week was my signal, and I took it instead of building a third bespoke auth layer.

## See it / build on it

- [MCP-Host on GitHub](https://github.com/StanislavBG/MCP-Host) — gateway, SDK, CLI, three pilot providers
- [signal-builder](https://github.com/StanislavBG/signal-builder) — a pilot provider, trading signals
- [How the providers came to exist](/blog/signal-builder-m0-to-m9) — the refactor that turned libraries into services

## FAQ

**Isn't a whole MCP storefront over-engineering for three providers?**
It would be if three were the target. They're pilots. The shared parts — OAuth, an x402 wallet, per-tenant Postgres isolation, metering, registry syndication — are identical for provider four and provider forty, and they're exactly the parts nobody wants to rebuild per repo. MCP-Host is a bet that I'll keep peeling standalone MCP services off bigger projects, and that they should share one billing-and-auth plane.

**Why x402 for billing?**
Because the customers are AI agents, and x402 is built for machine-to-machine, pay-per-call settlement without a human entering a card. One shared wallet across all providers means an agent funds once and can call any MCP on the host. Fail-closed by default means an unpaid call doesn't reach provider code.

**What does "per-provider RLS" buy me over just separate databases?**
Isolation without operational sprawl. Row-Level Security schemas mean one Postgres instance enforces that provider A — and tenant A1 — can never read provider B's rows, at the database layer, not in application code. Separate databases would give the same isolation and ten times the ops burden. RLS is how one control plane stays one control plane.`,
    'build-log',
    '2026-06-03T17:30:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'hardening-the-trading-stack-before-the-mcp',
    `Hardening the trading stack before opening the MCP`,
    'Last week MCP-Host turned internal libraries into hosted, paid MCP services. This week I had to make one of those libraries actually safe to expose. signal-builder was about to get a public endpoint, and Burrow underneath it was running a browser-control server on port 8765 with no auth at all. The whole week was the hardening pass that had to happen first — plus the sentiment bug where "BE" parsed as a stock you could buy.',
    `Last week I wrote up [MCP-Host](/blog/mcp-host-istore-for-mcps) — the gateway that turns internal libraries into hosted, paid MCP services. This week I had to make one of those libraries actually safe to put behind it. signal-builder, the trading-signal engine, was about to get a public endpoint. Burrow, the Reddit-gathering layer it sits on, was running a browser-control server on port 8765 with no auth at all. Before a single outside agent could call any of it, both needed a hardening pass. That pass was most of the week.

## "BE" is not a stock you can buy

The bug I'm least proud of: for weeks the sentiment pipeline treated any uppercase token as a ticker symbol. That's fine until a Reddit comment says "I would BE careful" or "just RIDE it out" — and the analytics layer dutifully logs sentiment for $BE and $RIDE as if they were positions. They *are* real tickers (BE is Bloom Energy, RIDE was Lordstown), which is exactly why a naive uppercase match swallows them.

The fix (commits 76100789, 417ed1b4) is a contextual guard: a common-word ticker only counts when the surrounding text actually looks like trading talk. I'd shipped the easy version — uppercase-means-ticker — and let it run, because in my own test threads nobody wrote "BE" as a verb. Real Reddit does, constantly.

## Burrow's port 8765 was wide open

Burrow drives a real browser to gather posts, and it exposed that control surface on localhost:8765 with no token, no SSRF guard, and a path-join that trusted its input. On a single-tenant box that's survivable. The moment signal-builder becomes a public MCP, Burrow is reachable infrastructure, and "it's only localhost" stops being a security model. Commit 173f438c added token auth, an SSRF guard on the fetch path, and a path-traversal fix — one commit, three holes that should never have been open.

## signal-builder's public-surface pass: PRDs 44–50

The bulk of the week was seven PRDs in signal-builder, almost all about what happens when a stranger calls your endpoint:

- **PRD 46 / 47** — public-surface hardening, plus validating the LLM's own output: the scorer asks Claude for primary_tickers, and it no longer trusts that answer blindly.
- **PRD 44 / 45** — the sentiment cache got WAL mode, a busy_timeout, batched upserts, bounded IN() lists, and index hygiene. Public reads can't be allowed to lock the writer.
- **PRD 48** — cut the Burrow round-trip fan-out, because every public call that hits Burrow N times is a public call that can knock Burrow over N times.
- **PRD 49 / 50** — panel-history retention (no pure-read persistence) and the multitenant auth / rate-limit / metering design for the public MCP.

Then a post-review pass closed a cursor transport-hole, a prune-replay bug, and some public-surface bounds. The theme across all of it: the eval cursor must never advance past an unscored post (afad1440), and a Burrow transport failure must never be mistaken for "genuinely no data" (4914ff0b). Both are the same class of bug — a failure that silently looks like success — and both are lethal when the output is a trade. signal-builder is at 543 test functions now, most of them pinning exactly these edges.

## A North-Star metric that wasn't there

The other half of the week was admitting I had no number for whether Burrow was actually *seeing* the market. I added a North-Star Reddit-coverage KPI (74748fca) and immediately found the gatherer was starvation-capped — it went deep on a few subreddits instead of broad across many. The fix (7a78ece0) flipped the binge from depth to breadth, which is the opposite of what felt productive: more posts per sub looks busier. Coverage was the KPI; posts-gathered was the vanity metric hiding behind it.

I also made health tell the truth: a stale system-health snapshot now downgrades to RED instead of reporting the last-known GREEN (797021b1). A monitor that goes green when it stops updating is worse than no monitor. Burrow went 0.8.1 → 0.8.3 across these passes.

## The outage I caused mid-refactor

One self-inflicted incident worth recording: I restructured Burrow's config loading and broke .env import order, which silently killed the browser lane — the gatherer kept running but couldn't drive a browser. The fix was one line (load .env at config import, 22c7fd68), but it was live longer than I'd like because the health layer at the time still said GREEN. That's not a coincidence with the previous section: the stale-green bug is exactly what let a real outage hide.

## What I'd do differently

I hardened the public surface in the same week I was still reshaping it — PRDs 44 through 50 were both changing the contract and locking it down at once. I should have frozen signal-builder's public tool signatures first, then hardened against a fixed target. Twice I hardened a function and then changed its shape two commits later, which means the security review was partly aimed at code that no longer existed. Next public-MCP candidate gets contract-freeze, then harden, then expose — in that order, not braided together.

## See the stack run

The public face of all this is the trade-in-public dashboard — Alpaca account vs SPY, the live trade log, and the Reddit-signal provenance behind each position: [social-signals-trader](/projects/social-signals-trader/). The signal engine itself is [signal-builder](https://github.com/StanislavBG/signal-builder); the gathering layer is [burrow](https://github.com/StanislavBG/burrow).

## FAQ

**Why a contextual guard instead of an allowlist of valid tickers?**
An allowlist of ~6,000 symbols would still match BE and RIDE — they *are* valid tickers. The problem isn't unknown symbols, it's real symbols colliding with common English words. Only context disambiguates "BE careful" from "$BE earnings," so the guard has to read the sentence, not the symbol table. An allowlist would have given me false confidence and the same bug.

**Is exposing a trading-signal engine as a public MCP a liability?**
The signals are sentiment and catalyst data, not advice, and the dashboard shows the actual Alpaca P&L against SPY so nobody has to take my word for edge. The hardening in this post is exactly the work that makes "public" defensible: rate limits so one caller can't drain it, metering so usage is accountable, and output validation so a prompt-injected Reddit post can't steer the scorer.

**Why keep SQLite (WAL + busy_timeout) for something going public instead of moving to Postgres?**
Because the read pattern is cache-shaped and single-writer, and WAL plus a busy_timeout handles concurrent public reads against one writer without the ops weight of a server. MCP-Host already runs Postgres with per-tenant RLS for the multi-tenant data; signal-builder's sentiment cache is local, disposable, and rebuildable. Two different problems, two different stores — moving the cache to Postgres would buy isolation it doesn't need.`,
    'build-log',
    '2026-06-13T10:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'coverage-debt-making-burrow-visit-what-it-skips',
    `Coverage debt: making Burrow visit what it skips`,
    'Last week I gave Burrow a North-Star coverage number and found the gatherer went deep on a few subreddits instead of broad across many. This week was the machine that chases the number: a selector that picks subs by how overdue they are, a breadth sweep that makes wide gathering cheap, and a bug where the metric I built to stop lying was collapsing to near-zero every midnight. Coverage is 80.4% now — and the middle tiers are exactly where it still fails.',
    `Last week Burrow got a coverage KPI for the first time: over any rolling 24h, visit every trading subreddit at least as often as its tier demands. The number existed, but nothing in the gatherer was *optimizing* toward it — the binge walked whatever feed was in front of it and went deep, because more posts per sub looks busier on every dashboard that isn't this one. A coverage KPI with no selector chasing it is just a thermometer. This week I built the thing that reads the thermometer and moves.

## The selector picks by debt, not by feed

The core change is \`CoverageDebtSelector\` (PRD 81, commit \`a88e905\`): instead of gathering the most active subs, Burrow now ranks every trading sub by how *overdue* it is against its tier cadence — P0 wants a visit every 4h, P3 every 24h — and spends its next session on the most-starved ones first. A sub that's met its target drops to the back of the line even if it's loud right now.

Two refinements landed on top: a tier-floor plus \`fresh_cap\` so a single hot sub can't monopolize a session (\`44e30cc\`, KPI iter-1), and a \`min_mention_yield\` demote (\`0798896\`, ported into the selector at \`1ca168d\`) that pushes down targeted ticker-subs that keep coming back empty — overdue *and* unproductive is worse than overdue alone. The selection logic lives in \`app/pipelines/reddit/selectors.py\`; the tiers are a flat YAML knob (\`data/reddit-coverage-tiers.yaml\`) so re-tiering a sub by trader value is a one-line edit, not a code change.

The value is narrow and concrete: Burrow now visits the subs it's been quietly skipping, on a schedule it can be measured against, instead of the subs that happen to be in front of it.

## Breadth is only affordable if each sub is cheap

Telling the gatherer to go wide is free advice unless each visit costs less. So most of the throughput work was making a single sub-visit cheaper, then spending the savings on more subs:

- **\`subs_per_session\` 5 → 9** (\`73e335a\`, coverage-loop iter 2) — nearly double the subs per binge.
- **Per-sub cost cut ~3×** (\`b9836ed\`) via brisker pacing and narrower sort/drill knobs — the budget that paid for the 5→9 bump.
- **A shallow \`reddit_breadth_sweep\` pipeline** (\`52f3e9d\`, tier P5) — a tail pass that touches the long tail of P3 subs just enough to clear the daily floor, without the cost of a full binge.
- **Per-pipeline \`pacing_profile\`** (\`15722bb\`) — each pipeline scales its own delay/sleep factor, so the breadth sweep can run fast-and-shallow while a deep binge stays human-paced.

The constraint behind all of this is one browser lane — Burrow drives a single headed Chromium, so throughput isn't "add workers," it's "make each visit shorter." The live scorecard says the gatherer spent ~4.7 hours of actual session time across 24h; breadth has to fit inside that, which is why the cost cut came first and the subs-per-session bump came second.

## Ticker gaps don't need the browser at all

The other way to widen coverage was to stop routing everything through that one browser lane. PRDs 99/100/102 added a browser-free ticker search over \`old.reddit\` (\`0f2df14\`, \`83b7eba\`), a gap-driven gather that fires when a tracked ticker has gone stale, and a catalyst-aware \`ticker_data_state\` index that knows which tickers are under-covered (\`2e56844\`). A ticker that's overdue can now get a lightweight HTML fetch instead of waiting for the browser lock to free up. The same idea went to the X side — ticker-targeted cashtag search in the feed extractor (\`a71f0a2\`). Coverage stops being hostage to a single serialized resource.

## The metric was lying at midnight

The honest mistake: the coverage headline was computed over a *calendar-day* window, not a rolling 24h. So every night at 00:00 it collapsed to near-zero and spent the morning climbing back — the KPI I'd built specifically to stop the system lying about itself was, for a few hours a day, lying about itself. The fix (\`d96ec2b\`) switches the headline to a true rolling-24h window so midnight is no longer a cliff. I also localized the trend buckets and timestamps to America/Los_Angeles PT (\`d127ca6\`), because a coverage chart that resets at UTC midnight is unreadable to someone reading it at 5pm Pacific.

It's the same failure as last week's stale-green health bug, one level up: a measurement that looks like a real signal but flips on a clock boundary nobody's watching. Building the metric is the easy 80%; making the metric tell the truth at every hour of the day is the other 80%.

## Where coverage actually stands

Grounded in the live scorecard (\`scripts/coverage_scorecard.py\` → \`downloads/coverage-scorecard.json\`), not a vibe:

- **80.4% coverage** across a **101-sub** universe, **65 subs** currently meeting their target, **8 daily-floor breaches**.
- By tier: **P3 (daily floor) 92%** — the breadth sweep is doing its job on the long tail. But **P1 72% (5 of 19)** and **P2 63% (11 of 26)** — the mid-tiers are the frontier.

That tier split is the whole ongoing focus in one line: the cheap-and-wide machinery fixed the daily floor, but the *medium-cadence* subs — every-8h and every-12h — are where coverage still leaks, because they need to be revisited often enough to cost real browser time but aren't urgent enough to win a P0 slot. That's next week's problem, and now there's a number to know whether I've solved it.

## What I'd do differently

I raised \`subs_per_session\` to 9 *before* I had the per-sub cost cut fully landed, so for a couple of binges the sessions ran long and the timeout sweep (\`8182dbb\`) had to reap stuck pipelines that were just slow, not stuck. The right order was cost-cut first, then widen — measure the new per-sub cost, *then* spend it. I widened on optimism and let the throughput ceiling catch it, instead of the other way around.

## See it run

The coverage feeds the signal engine behind the trade-in-public dashboard — [social-signals-trader](/projects/social-signals-trader/). Burrow itself is [github.com/StanislavBG/burrow](https://github.com/StanislavBG/burrow).

## FAQ

**Why optimize coverage instead of captures-gathered?**
Captures is the vanity metric — it rewards going deep on whatever's already loud, which is exactly the behavior that left mid-tier subs unvisited for a day. Coverage measures *reach*: quality discussion I never visit is quality I never capture. Captures is downstream of coverage, not a substitute for it.

**Why not just run the gatherer longer to hit 100%?**
Because there's one browser lane and ~4.7h of real session time in the scorecard's 24h window — wall-clock is the hard ceiling, not effort. 100% coverage at current cadence isn't a "run it more" problem; it's either cheaper visits (this week's work) or honest re-tiering of low-value subs down so the target is actually reachable. A KPI you hit by lowering the bar is fine *if you say so* — letting it sit unreachable is the dishonest option.

**Why per-tier cadence instead of one flat "visit everything daily"?**
Because r/wallstreetbets at the same cadence as r/Bullion wastes the budget at both ends — the firehose goes stale in 4 hours and the niche sub doesn't change in 12. Tiering by trader value is how a fixed throughput budget buys the most decision-grade signal.`,
    'build-log',
    '2026-06-18T10:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'coverage-got-burrow-to-the-post-recall-reads-it',
    `Coverage got Burrow to the post. Recall reads it.`,
    'Last week I gave Burrow a coverage number and made it visit every trading subreddit on a schedule. This week I checked whether it actually pulled the tickers out of the posts it visited — and found fresh NVDA and ETH captures sitting untagged for ~2 days while the tagger ground through a 19,145-file archive backlog in filename order. The fix was a sort. The harder fix was the metric I built to catch this, which was itself lying — counting "A", "O", and "AI" as ticker mentions and reporting recall at 0.22.',
    `Last week's post ended on a coverage KPI: over any rolling 24h, visit every trading sub at least as often as its tier demands. Burrow hit 80.4% and I called the binge "measured." But coverage only measures whether Burrow *opened* the post. It says nothing about whether the ticker named in that post — the entire reason to read Reddit — made it into the index where the signal-builder side can see it.

It hadn't. An external feedback item (sb-req-12) flagged that head tickers were being captured but not extracted for roughly two days. The capture was fine; the *mention extraction* was lagging two days behind it. Coverage was green while the thing coverage exists to feed was stale.

## The lag was a sort order, not a throughput problem

Root cause (PRD 139, \`13c8c89\`): the incremental tagger built its to-do list from \`iter_reddit_captures()\` in **filename-sorted** order — inbox then archive — and stopped at \`INCREMENTAL_PER_RUN_LIMIT=150\` per 4h run. With 63 inbox files and 19,145 untagged archive files, every run spent its whole budget on the front of the filename sort. A fresh NVDA capture that got swept into the archive sat at the *tail* of that sort and waited ~2 days for its turn. Burrow wasn't under-powered; it was tagging the wrong 150 files.

The fix is the kind that's embarrassing to write down because it's so small: for the incremental path, materialize all eligible un-tagged captures, sort by \`captured_at\` descending, *then* apply the 150 limit. Now each run always spends its budget on the freshest un-tagged captures regardless of which directory they're in. The full archive re-tag and windowed backfill paths kept their existing streaming behavior — this only changed the scheduled tick. O(n log n) in eligible-capture count, which is cheap next to two days of recency debt.

## The metric I built to catch this was lying too

To make sure this never silently regresses, PRD 140 (\`ecb6f0c\`) added a \`capture_to_mention_recall_24h\` figure plus a \`head_ticker_recall\` parity check to \`gather_status\`, with a \`low_recall\` health verdict that fires below an 0.80 SLO. Schema bumped 1→2, version 0.8.6→0.8.7, 461 lines of new reader tests. Then I looked at the number it produced: **0.22**. Permanently tripping \`low_recall\` on what looked like a catastrophe.

It was the metric, not the system. The recall denominator was a naive whole-word body scan against the *full* ticker universe — which contains \`A\`, \`C\`, \`O\`, \`T\`, \`V\` and word-collisions like \`AI\`, \`EV\`, \`ON\`, \`OR\`. Every post containing the word "or" counted as "a post naming a ticker." The denominator was inflated with noise, so recall cratered to a meaningless 0.22, and the "head tickers" it reported as missed were single letters.

The fix (\`6ee995c\`) extracted \`load_eligible_universe()\` — the universe minus ambiguous words, the negative filter, and anything shorter than two characters — and pointed the recall scan at *that*, the same matcher extraction already uses. One matcher, shared, no standalone regex drifting from the real one. Recall moved to **0.375** and the head-miss list turned into actual tickers: BTC, GME, VOO, ETH, MSFT, SPY. 0.375 is still under the 0.80 SLO — but now it's an honest 0.375 measuring genuine extraction lag, not a collision artifact. Four red-first tests in \`TestCollisionFiltering\` now assert that an "AI"/"A" post can't inflate the denominator.

This is the same failure as last week's midnight coverage cliff, one rung up: a metric that looks like signal but is dominated by an artifact nobody's inspecting. The first 80% is building the gauge. The second 80% is proving the gauge isn't measuring its own wiring.

## Widening the inputs without touching the browser lane

The other move this week was giving Burrow signal sources that don't queue behind its single headed-Chromium lane — because every recall win is wasted if the only way to gather is the one serialized browser.

- **Catalyst calendar** (PRD 145, \`38ee1cf\`): a Burrow-owned \`catalyst_calendar_collect\` pipeline pulling Nasdaq earnings JSON plus a bounded \`claude -p\` macro-events pass into an \`analytics.db\` table, with idempotent \`(ticker, event_type, event_date)\` upserts and a Tier-1 MCP read \`upcoming_catalysts(within_days, event_type, ticker)\`. Burrow now *knows* what's coming, instead of finding out after the move.
- **Web opinion gather** (PRD 146, \`c6b1a66\`): an \`internet_search_opinion\` pipeline that, for every ticker with a catalyst inside 15 days, gathers symmetric bull/bear web opinions — a drain-job at 5 tickers/run, 20/day cap, 6 balanced queries each, URL-hash dedup, indexed through the existing brain indexer. No browser. 14 TDD tests.

These two chain on purpose: the calendar decides *which* tickers are about to matter, and the opinion gatherer spends a browser-free budget pre-loading context on exactly those. Coverage chases breadth; this chases the handful of names a catalyst is about to make loud.

Two reliability fixes rode along underneath. The indexer was silently failing 38–53 of every ~78 files per batch because a batch could carry duplicate \`distilled\` permalink ids and Chroma rejects the whole upsert on a non-unique id — collapsing the parallel lists through a dict keyed on id (last-wins) before upsert fixed it (\`b4c61b4\`). And the dashboard got a Positions tab (PRD 138) with health verdicts and platform standing — which immediately surfaced its own bug, where a platform inside its mandatory post-gap window was rendering as healthy because the classifier set the reason string but never flipped \`healthy=False\`.

## What I'd do differently

I'd have built the recall metric *before* the coverage metric, not after. I spent last week optimizing breadth on the implicit assumption that visiting a post meant ingesting it — and that assumption was wrong by two days. Coverage and recall are two halves of one number; shipping the half that's easy to graph (did we open it) ahead of the half that's the actual goal (did we extract it) is how you end up with a confident dashboard and a stale index. Next pipeline metric, I build the output-side gauge first and let it tell me whether the input-side gauge is even worth optimizing.

## FAQ

**Why not just raise \`INCREMENTAL_PER_RUN_LIMIT\` past 150 to drain the backlog faster?**
That treats a 19,145-file backlog as a throughput problem, but the lag was an *ordering* problem — fresh captures were starving regardless of total budget. Raising the limit burns more compute every run forever to paper over a sort that costs nothing. Sort first; only then ask whether 150 is the right number.

**Is recall at 0.375 not just as alarming as 0.22 was?**
0.375 is a real measurement of genuine extraction lag, captured the morning after PRD 139 landed but before a full tagger tick had drained the backlog (the host slept overnight, so 139 was deployed-but-unconfirmed at the time of the reply). 0.22 was a number that could never improve because it was measuring collision noise. An honest low number you can move beats a fake low number you can't.

**Why does Burrow own a catalyst calendar instead of querying one at read time?**
Single-sourcing it into \`analytics.db\` means the opinion gatherer, the MCP, and the dashboard all read one idempotent table instead of three components each hitting an external API on their own cadence and disagreeing. The collector is the only thing that talks to Nasdaq; everything downstream reads Burrow. The coverage this feeds drives the [social-signals-trader](/projects/social-signals-trader/) dashboard; Burrow itself is [github.com/StanislavBG/burrow](https://github.com/StanislavBG/burrow).`,
    'build-log',
    '2026-06-21T10:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'i-gave-sigma-a-way-to-see-the-network',
    `I gave Sigma a way to see the network, not just the rows`,
    'Sigma always had the data — every Bulgarian public contract, authority, and supplier — but no way to see how they connect. This week I shipped the relationship graph: pick a company, see the network around it, click to walk the money outward one hop at a time. Plus a competition view and a spending trend. I even built multi-focus and ripped it back out.',
    `Sigma has always had the data — every Bulgarian public contract, every authority, every supplier. What it didn't have was a way to *see* how they connect. You could read the rows; you couldn't see the shape. This week I fixed that.

The change I care most about is the relationship graph. Pick a company or an institution and Sigma draws the network around it, with the contract value written on each edge. Click a node and it recenters — so you walk the money outward one hop at a time instead of opening twenty pages and holding the connections in your head. I went back and forth on letting you focus on up to three entities at once, built it, and then ripped it back out: the multi-focus graph looked impressive and read like noise. One focus, click to move it, is the version that actually answers a question.

Two more views shipped alongside it. A Competition page that shows single-bid share and supplier concentration per authority — the contracts that only ever drew one bidder, sortable instead of buried. And a Trend view that lays spending out by month and year, so the end-of-budget-year spikes show up as a curve.

The unglamorous half was hosting. [Sigma Plus](https://sigma-plus.replit.app) is the live, daily-updated build, and I wanted redeploys to never wipe the data — so the corpus now lives in object storage and restores itself on every deploy, with a 30-minute refresh channel pushing new records in. It self-heals now, which means I stop babysitting it.

Next I want the graph to remember where you've been — a breadcrumb of the path you clicked through, so a long chase is reproducible. For now: pull a name you recognize and start clicking → [sigma-plus.replit.app](https://sigma-plus.replit.app)`,
    'product',
    '2026-06-24T10:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'session-manager-034-dormant-tabs',
    `Session Manager 0.34: tabs that cost nothing until you talk`,
    'Tabs used to spawn a live process the moment you opened them. As of v0.34.0 a new tab is a dormant chat box — nothing runs until you send a message — and it remembers its conversation across restarts. Plus the chat engine rewrite that stopped parallel Claudes from eating the machine.',
    `Session Manager tabs used to be expensive. Opening one spawned a real PTY and a real \`claude\` process immediately, so a window full of tabs was a window full of running processes, and every app restart re-spawned all of them. As of v0.34.0, a new tab opens as a lightweight chat box and stays dormant — no PTY, no process — until you actually send a message. Tabs also rehydrate their prior conversation on mount, so reopening the app shows history instead of a blank box.

The chat engine behind this got rewritten once before shipping. The first version used a reject-at-capacity semaphore allowing 3 concurrent runs, which fanned out into parallel \`claude\` processes that ran the machine out of memory and got a scheduled job SIGKILLed mid-edit. The replacement is a FIFO queue copied from the scheduler, capped at one run at a time — bursts now queue with a visible position instead of erroring. The fix for too many Claudes came from the one part of the app that already knew how to run exactly one job.

Also shipped in the 12 commits of this release (PRDs 318–325):

- A **Timeline view** in the Knowledge Graph tab: searchable, newest-first conversation history per project, with expandable verbatim exchanges, logged to \`~/.claude/knowledge-log/\`.
- The scheduler's orphan-requeue cap raised from 2 to 5.
- An e2e test asserting zero \`claude\` processes on boot — which kept false-positiving on the app's own power-blocker, because \`systemd-inhibit --why\` contains the string "claude -p jobs". It now keys on the process name, not the command line.

One skip to be honest about: the end-to-end Send round-trip test is checked in but disabled, marked "needs auth + spawns claude; run it manually when the machine is quiet."

Session Manager is the local cockpit for the Claude Code CLI — multi-tab terminal, scheduler, voice dictation, live observability. It lives at [/projects/session-manager/](/projects/session-manager/).`,
    'product',
    '2026-06-28T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'sigma-quality-index-which-contracts-look-unhealthy',
    `Sigma can now tell you which contracts look unhealthy`,
    'Sigma always told you what happened in Bulgarian procurement. The new quality index tells you whether it looks healthy: a 0-1 score over five pillars, blended 60% mean / 40% worst pillar, across 194,481 contracts — with unknown never counting as zero.',
    `Until now, [СИГМА](https://sigma.midt.bg) told you *what happened* in Bulgarian public procurement: who bought what, from whom, for how much, traceable to the source notice. Whether a contract looked *healthy* was your problem — you eyeballed single-bid awards, annex counts, and overruns one contract at a time.

The new [Индекс на качеството](https://sigma.midt.bg/quality) page answers the question directly. Every contract gets a 0–1 health score built from five weighted pillars: contestability (how many bids, judged against comparable contracts, not an absolute count), procedure openness, value integrity (annexes, overruns, estimate accuracy), relationship health (repeat wins, buyer–supplier concentration), and transparency. The blend is 60% weighted mean, 40% worst pillar — so a contract can't average its way out of one catastrophic dimension.

What you can do with it:

- Rank authorities, suppliers, sectors, regions, years, and funding sources — **sorted weakest-first by default**. The page opens on the problems.
- Click any bar of the score histogram to get the exact contracts behind it. "Every contract scoring under 20 in construction in 2024" is a URL, not an export-and-pivot exercise.
- Open any contract's decomposition and see which pillar dragged it down, with each pillar's weight and contribution drawn to scale.

The rule that shaped the whole index: **unknown never counts as zero**. A missing pillar drops out of the average entirely; a contract with under 40% data coverage gets no score at all rather than a misleading one; an authority needs 20 scored contracts before its average is published, so a municipality with three contracts can't top the worst-offender table. The UI renders missing data as „—" with a tooltip saying exactly that.

That rule earned its keep during review. The lowball-then-amend detector — flagging contracts whose first amendment inflates them over 30% within 90 days — was silently comparing amendment values against signing values *without checking they were in the same currency*, and scoring unscorable rows as clean. Both paths now resolve to unknown.

The numbers behind the launch: 194,481 contracts scored, 18 of 18 spec validation checks passing, and the pipeline's reconciliation gate verified against the full corpus — 193,902 contracts, EUR 51.7bn, residual 0.00.

Next up: joint procurements (about 8% of authority records name multiple co-buyers on one notice) are currently excluded rather than misattributed — attributing them to each real co-authority without double-counting value is the open product decision.`,
    'product',
    '2026-07-02T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'signal-builder-tombstones-stop-retrying-the-dead',
    `Teaching signal-builder to stop retrying the dead`,
    'One unfetchable Reddit permalink could freeze a ticker\'s sentiment cursor forever — RKLB was held 29 times. The fix is a tombstone ledger: three attempts, four hours apart, one last salvage probe, then move on. Plus an honest bet about where the real bottleneck is.',
    `I shipped a fix this week for a bug that was quietly freezing sentiment coverage for about 48 tickers.

Signal-builder is the scoring layer between Burrow (which gathers Reddit and social content) and anything that consumes per-ticker sentiment — the [social-signals-trader](/projects/social-signals-trader/) being client number one. An hourly curator walks each ticker's new mentions behind a cursor. Some mention permalinks can never be resolved into a post body: the search index doesn't serve them and the mention carries no context fallback. The old code treated "something is missing" as "hold the cursor and try again next hour" — with no memory of *what* was missing or how many times it had already tried.

One poison-pill permalink could therefore hold a ticker's cursor forever. The mention-scorer log counted the damage: RKLB held 29 times, SPCE 28, PYPL and BNB 24 each. For thin tickers the unfetchable post was often the day's *only* post, so the series stopped advancing and dropped out of the freshness window that decides whether a series is sellable — 157 of the 200 tickers on the worklist were blocked on exactly that recency criterion.

The fix is a small ledger of unresolved items: each gets 3 fetch attempts spaced at least 4 hours apart (enough to absorb normal index lag), then a tombstone. Tombstoned items stop counting as "incomplete," so the cursor moves on, and they're never re-fetched. The one decision I'd highlight: tombstoning alone would silently accept a lost day, so before giving up, the code fires one last day-level probe to find *any other* fetchable post from that date. Only if that comes back empty is the day conceded. 554 lines, well over half of them tests.

Honest caveat, written on the day of shipping: this bets that stuck cursors are the binding constraint on sellable series (currently 30, against a ~540-ticker ceiling). If the real bottleneck is somewhere else — say, how many tickers the scorer can actually visit per tick — unblocking cursors won't move that number. Mid-July will tell.`,
    'build-log',
    '2026-07-06T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'the-topic-tagger-kept-answering-only',
    `The topic tagger kept answering „само"`,
    'Measuring how Bulgarians react to Sigma on Facebook meant asking a 3B local model to tag topics — and it answered with the word "only." Three rounds of tag garbage, a format contract that broke silently, and the filter that removes noise and headlines alike.',
    `Sigma-plus is a measurement pipeline that asks one question: is anyone actually reacting to [СИГМА](https://sigma.midt.bg), and what are they saying? Burrow monitors the two Facebook pages where the platform gets discussed, and a local model (qwen2.5:3b via Ollama, deliberately on-machine — the corpus is public speech by named citizens, and it stays here) tags each comment with sentiment and up to three Bulgarian topic tags.

The topic tags came back garbage, three times, differently each time.

Round one: on a corpus where every single item is about Sigma, the model tagged everything „сигма" and „платформа". Useless. The fix was a blocklist plus a rule that generalizes it: drop any tag attached to more than 60% of items, because a tag that describes most of the corpus describes none of it.

Round two: with the catch-alls gone, the model reached for function words. The blocklist additions from that commit are the whole story: „само" (only), „още" (still), „вече" (already), „обаче" (however), „значи" (so). Ask a 3B model to name a topic and it hands you the word "only." The database still holds the fossil: a cached summary keyed to the topic „само", earnestly stitching together two unrelated citizen comments. What survived the filters was real — „реформа" (116 items), „корупция" (112).

Round three was the summarizer. Fed a numbered list of tagged quotes and asked for two flowing sentences, it echoed the input format straight back — numbered list, \`[positive]\` labels and all. The fix bans the format in the prompt *and* strips it with a regex, because I didn't trust the prompt to hold.

Meanwhile the corpus itself grew up. The first harvest crawled Burrow's embedding index with ~40 hand-written probe queries and snowballed from there — 120 queries recovered roughly 35 items from a 985-chunk collection, with no way to know the true fraction. Two things fixed that. A flag I'd simply missed (\`include_body:true\`, surfaced by Burrow's own root-cause writeup after I filed a "posts have no text" report that turned out to be reader-side) took one page's comments from 23 to 129 in a single run. Then Burrow shipped \`list_chunks\` on my request — plain cursor pagination over the whole collection — and coverage became exact: 1,005 of 1,005 chunks enumerated, footer switched from „частична извадка" to „ПЪЛНО".

The sting came a day later. Burrow had declined to add structured comment fields because my parser read its excerpt labels fine — "parses beautifully — nice format." Then a new ingest changed the label prefix from \`[Facebook comment …]\` to \`[SIGMA comment …]\`. No error anywhere; about a thousand comments silently vanished from the classified set, caught only because a human noticed a reel with 200+ comments while the page total showed ~130.

What I'd do differently: the moment two systems agree on a text format, write the format down and test it on both sides. The prefix-agnostic parser with its own test file exists now; it should have existed before the compliment.

The cost worth admitting: the 60% cap that removes noise also removes the most common genuine tag — „прозрачност" (transparency), on 73% of items, which is both the corpus's actual subject and invisible in the topic list. The heuristic can't tell a catch-all from a headline.`,
    'deep-dive',
    '2026-07-11T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'sixty-five-hours-of-silence',
    `65.6 hours: what a starved pipeline looks like`,
    'Burrow\'s Facebook posting pipeline went 65.6 hours without a run while every individual scheduling decision was correct. The fix is one concept — starvation — plus two more repairs to instruments that were lying in both directions at once.',
    `The number that moved this week: Burrow's Facebook posting pipeline went 65.6 hours without a single run — last post July 15 at 21:20 UTC, next on July 18 at 14:55, eleven minutes after the fix landed. Its sibling football-page pipeline: 63.2 hours. Both measured straight from the orchestrator's run database, both back to their normal twice-daily rhythm since.

The cause is the interesting part: no single scheduling decision was ever wrong. The posting pipelines are restricted to a narrow daily window; after an outage, a backlog of always-available pipelines was legitimately winning the priority comparison every time that window came around. Starvation emerged from a day of individually correct choices. The fix adds one concept — a restricted-window pipeline overdue by 24+ hours is *starved* — and sorts starved work above everything else, with normal priority still breaking ties.

That was one of three fixes in the same hardening pass, and the honest thread through all three is that Burrow's automation mostly worked while its instruments lied in both directions:

- The activity report counted **in-flight runs as failures** — a health check that manufactured failures out of its own timing. For scale: the window July 10–19 actually saw 3,594 completed runs against 15 real failures.
- The dashboard could show a pipeline as "running" **forever** — the running-state restore ran only at construction, never on refresh, so a pipeline mid-run when the dashboard started stayed "running" long after it finished. Introduced and fixed the same day, caught by code review.
- The loudest one: Reddit's promoted posts open advertiser sites in new tabs when clicked, the gather pipeline clicks by screen coordinates with no concept of an ad, and nothing ever closed those tabs. Zero log trace — the leak was invisible to every monitor and was reported by the human watching ad tabs pile up on screen. One captured ad had even made it into the signal corpus as a "post." Popups now get closed on arrival and promoted posts are excluded from both click and capture paths.

Next: the gather schedule itself is being rethought — more on that within the week.`,
    'build-log',
    '2026-07-18T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'the-web-remote-now-survives-a-reload',
    `The web remote now survives a page reload`,
    'Pairing a phone to the desktop cockpit meant re-verifying the SAS code on every reload, because the browser key was born fresh each time. The fix rests on a browser fact worth knowing: IndexedDB can store a non-extractable CryptoKey directly.',
    `I shipped v0.35.17 and v0.35.18 of [Session Manager](/projects/session-manager/) this week; the part I want to write down is the phone remote's trust model.

The web remote lets a browser drive the desktop cockpit end-to-end encrypted, with a short SAS code you compare on both screens to confirm the pairing. It worked, with one grinding flaw: every page reload generated a fresh browser keypair, so the desktop saw a stranger and demanded the SAS ceremony again. Reload, re-verify, forever.

The naive fix is to persist the key in localStorage — which requires marking the private key extractable, trading a reload annoyance for an actual weakening of the encryption. The fix that shipped rests on a browser fact I didn't know: IndexedDB, unlike localStorage, can store a **non-extractable** CryptoKey directly via structured clone. The private key persists across reloads without ever existing in exportable form. The desktop side is trust-on-first-use: a manual SAS confirmation pins that browser's public key to the device, exact key match reconnects silently, any other key still gets the full ceremony.

Same release, same theme of silent failure: the desktop's terminal-write handler reported success to the remote unconditionally — including when the write failed — so keystrokes from the phone could vanish while the phone showed everything fine. The write path now returns a real result and the remote surfaces it.

One more fix worth its sentence: the scheduler was flagging jobs for review because they "passed without committing anything," when the true story was that someone else had already merged the target PR. The verifier now checks the world before judging the diff.

Still rough, honestly: the fix for the mobile app hanging on its connect screen after pairing landed a day *after* the release tag, so it rides the next one. And the 772-test suite briefly broke main the morning after the big sweep — a test file written in the wrong framework's idiom, repaired the same day.`,
    'product',
    '2026-07-21T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'deleting-951-lines-to-hit-100-percent',
    `Deleting 951 lines to hit 100%`,
    'Burrow retired two of its three Reddit pipelines and pinned all 65 tracked subs to one honest target: once a day, every day. The scorecard reads 100% — because the target was made achievable, not because coverage multiplied. Plus two new repos in one day.',
    `Burrow ran three separate Reddit gather pipelines with a tiered coverage target — some subreddits every 4 hours, some every 8, some every 12. This week two of the three pipelines were retired (26 files, +32/−951, archived rather than deleted) and every one of the 65 tracked trading subs was pinned to a single target: visited at least once a day, inside one 5-hour overnight window. The scorecard now reads 65/65, 100%, zero floor breaches.

The honest version of that number: the target was made achievable and then achieved, not multiplied. The retirement commit says the quiet part out loud — a once-daily gather window can't deliver a 4-hour cadence, and nobody could point to a decision the tier distinction actually fed downstream. A KPI nobody consumes measuring a cadence nothing can deliver is a KPI that lies; this one no longer does.

Also shipped this week:

- **claude-agents**, a new repo that puts the always-on agent instructions under version control — the global config is now a two-line loader importing versioned persona files. Best find during the move: an HTML-comment canary placed to verify the import chain turned out to be *invisible* — comments are stripped before reaching model context — so a broken import would fail silently. The canaries are now visible plain-markdown footer lines.
- **Shapes Foundation**, a new Expo app scaffolded in an afternoon: a shape-themed run-builder (triangle striker, square bulwark, circle arcanist) whose prototype game logic — 756 hand-written lines of typed Zustand store and view derivation — was ported out of a single-file HTML prototype, state machine intact, before any UI exists to consume it.

Both new repos are a day old and neither has a tile on [/projects](/projects) yet; the game gets one when there's something to play.`,
    'build-log',
    '2026-07-24T16:00:00.000Z',
  );

  // Catch-up backfill of the 2026-07-24 -> 2026-08-29 publishing gap: 9 posts at the
  // standing 3-5 day cadence, each backdated to when its work actually shipped
  // (blog.config.yaml cadence.backdating: honest-only). Drafted by
  // scripts/blog-cadence-watchdog.sh, reviewed and approved by a human before seeding.
  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'the-academy-course-is-now-just-about-claude',
    `The Academy Course Is Now Just About Claude`,
    `Academy swapped its 20-lesson generic-AI curriculum for a 12-chapter course on being a Claude user, then found a real bug by testing all 15 pages instead of 6.`,
    `[Academy](/projects/academy/) used to teach "what is an AI" in general — 20 lessons across 3 modules, the kind of foundations content that could describe any chatbot. This week it became a course about one specific thing: how to be a Claude user. 12 chapters, 4 modules — Meet Claude, Working In Claude, Prompting, Trust And Next Steps — plus a rewritten welcome page. The glossary picked up Claude-specific terms it never needed before, like Cowork and Claude in Chrome. It's a smaller course than it was (12 chapters instead of 20 lessons) and a more useful one, because it stops trying to be neutral about a choice the reader already made by showing up.

The swap touched 59 files — 4,075 lines added, 3,426 removed, so most of the old curriculum is gone, not layered under the new one.

The interesting part is what the follow-up commit caught. Academy's design-review testing had only ever hit 6 hardcoded routes with Playwright screenshots and an axe-core accessibility pass. Widening that to all 15 pages — the welcome page, all 12 chapters, both demo fixtures — surfaced a real bug: the "you're done" screen was rendering multiple identical "Start over" cards from a count-based loop, each one linking back to the course root instead of lesson 1, directly contradicting its own label. It had shipped invisibly because nothing was testing that page. Now all 15 pages get the same audit, and there's one correct card.

Also shipped: a docs fix admitting a real risk rather than a hypothetical one — \`AUTHORING.md\` now says plainly that \`pnpm build\` does not publish, because \`publish_static_project\` owns the copy and its gates, and hand-rolling a scratch script to skip that "silently skips the a11y and audit gates." Someone was tempted to take the shortcut; the doc exists so the next person isn't.

**What's next:** the new curriculum is live at [/projects/academy/](/projects/academy/) — if you've read the old foundations lessons, this is a different course, not a v2 of the same one.`,
    'product',
    '2026-07-28T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'five-stats-replace-twenty-two-that-did-nothing',
    `Five Stats Replace Twenty-Two That Did Nothing`,
    `A shape-themed action RPG went from a store with no UI to a playable combat build in a week — then a 7-iteration completeness audit found the archetypes had been mathematically identical the whole time.`,
    `A week ago this project — a shape-themed action RPG with a triangle striker, a square bulwark, a circle arcanist — was 756 hand-written lines of state management and nothing to look at: no weapon, no combat, no UI. This week it shipped v1.1.0 and became a game you can actually play: pick an archetype, drop into a run, move with a joystick, auto-attack with a real equipped weapon that branches between melee arcs and ranged projectiles, watch floating damage numbers and enemy HP bars, cast Frost Nova or Meteor Storm on real cooldowns, and see a Character Power score built from armor, crit, and spell power that are now actually wired into the combat math instead of sitting in a spreadsheet.

The redesign underneath all of that: the character sheet used to track 22 individually-leveled passive stats, and nothing consumed most of them. It's now 5 primary stats, with weapons, gear, and skills all deriving their real numbers as a joint sum off those five. Sixteen items — spells and gear, r1 through r16 — got scaled to the new system, one commit each.

Here's the part worth writing down. After the rewrite, a 7-iteration audit ran through the content looking for anything the redesign had silently broken. Iteration 6 found the best one: all three archetypes' advertised starting boosts — Striker gets +attack and +attack speed, Bulwark gets +HP and +armor, Arcanist gets +spell power and +mana — were dead. The function that applied them wrote to a field called \`Passive.lvl\`. The function that actually derives combat stats only ever reads \`primaryLevels\`. A fresh Striker, Bulwark, and Arcanist with the same points spent had byte-identical stats. Nothing threw an error. Nothing failed a build. The archetypes just quietly stopped being different from each other, and the only reason anyone noticed was a leftover code comment from the redesign — "all points are spent on primaries now" — that didn't match what the boost function was still doing.

That's the lesson: a structural rewrite doesn't announce what it broke. The audit that caught this wasn't triggered by a bug report; it was a deliberate pass looking for exactly this class of silent disconnect, and it found six more of the same shape before this one and one more after (an XP-gain no-op, the final iteration). Nine more detailed stats — penetration, area-of-effect, evasion, luck, cooldown reduction, pickup radius, regen, resistance, block — are confirmed dead too, and still are; some, like penetration, need a mechanic (enemy armor) that doesn't exist yet to mean anything.

What I'd do differently: run that audit pass as part of the redesign, not a week after it. Every one of these bugs existed the moment the rewrite landed; the only thing that changed between "broken" and "found" was deciding to go looking.

Still rough: the EAS build handed off at the end of the week (build #8, ~3 hours to compile) was still in progress at handoff — the next session picks it up mid-build, with the submit and TestFlight steps written down but not run. And \`expo-doctor\` has been flagging six packages with drifted patch versions for a while now; that's been deliberately deferred, not fixed.

No tile on [/projects](/projects) yet for this one — it's still a build, not a release.`,
    'build-log',
    '2026-07-31T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'the-retry-that-cost-93-calls-to-fail-once',
    `The Retry That Cost 93 Calls To Fail Once`,
    `A flat 60-second timeout meant signal-builder's mention scorer retried doomed calls at the same size, up to 93 LLM calls to fail once. It now fails fast and splits instead.`,
    `The number that moved this week: the worst case for a mention-scoring batch that hits a timeout went from 93 LLM calls down to 31, and that's not a rounded estimate — it's a bound written into the code comments, because [Signal-Builder](/projects/signal-builder/)'s scorer splits a failed batch in half and retries recursively, so the call count is \`2^5 - 1\` at 5 split levels, times however many retries each level got.

The batches were timing out because a token-budget problem was being treated as a network hiccup. Every batch — whether it was 2 tickers or 50 — got the same flat 60-second subprocess timeout, and when a batch was too big to finish in that window, the retry logic tried the exact same call, at the exact same size, up to three more times before finally giving up. That's not a transient failure being retried through — it's a call that was never going to fit, burning roughly 200 seconds per split level on repeats of a call already known to be too big. One week's logs: 1,125 timeout warnings and 367 hard-timeout sentinels, with some ticks scoring only 2 to 4 of 50 tickers before the run deadline.

Two changes: the subprocess timeout now scales with chunk size instead of being flat, and a timeout on a batch call raises immediately instead of retrying at the same size — the caller splits the chunk and tries again smaller, rather than repeating a call that already told you it can't fit. Retries are kept only for the failures that are actually transient (a bad exit code, a parse error), not for the ones that are structural. New telemetry (\`pop_timeout_stats()\`) tracks timeout events and wasted seconds per tick, so the next grading pass has real numbers to check this against.

Worth saying plainly: the sibling fix that landed the day before this one (PRD 643, deadline-bound retry-split) didn't move throughput on its own — ticks after it shipped were still scoring only 2-4 of 50 tickers, which is why this fix was queued immediately behind it. And a prior optimization pass three weeks earlier was graded no-effect after shipping — flat 29-31 "sellable" tickers before and after — because it fixed something downstream of the real bottleneck. That history is why this one ships with its own telemetry instead of a claim.

This work isn't on GitHub yet — signal-builder's local branch is 116 commits ahead of what's pushed, so there's no commit to link here, just the fix as it stands locally.`,
    'build-log',
    '2026-08-04T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'a-bad-quote-almost-cost-14000-on-paper',
    `A Bad Quote Almost Cost $14,000 On Paper`,
    `A published-live P&L number was off by roughly $14,000 because a spread's cost-to-close wasn't bounded by its own width — the fix moves loss-boundedness into the structure of every trade, not just the exit logic.`,
    `[Social-Signals-Trader](/projects/social-signals-trader/) publishes a real Alpaca account against SPY, live, on this site — every position, fill, and rationale. This week it started actually trading options: a credit-spread sleeve, screened down from a 116-name pool to 20 underlyings across 10 correlation buckets, sized to 90% of equity, with a real profit target and a real stop. Before this, the book was equities-only in spirit; 28 raw option legs showed up on the dashboard as 28 unpaired, undifferentiated rows, and there was no loss-side exit at all — just a profit target and hope.

The dashboard now groups those into 14 real spread rows instead of 28 raw legs, has an options-book summary panel, a glossary with a Help tooltip on every term, and a trade-detail page rewritten as a walkthrough for someone who's never seen an options position before. That's the visible half of the week.

The half worth writing down is a bug that reached the public page. A vertical spread's maximum possible cost to close is mathematically bounded by its width — a $1-wide spread cannot cost more than $100 a contract to exit, full stop. A bad indicative quote on a short BABA call ignored that bound and produced a cost-to-close of $9,184 against a true maximum of $5,600. That number was live on this dashboard, overstating the account's loss by roughly $3,600 on that one position and distorting total published equity by something closer to $14,000 once it fed into the account-wide P&L. Around the same time, a second bug was found: close cost had been computed per share while credit and max-loss were computed per contract, which is a 100x unit mismatch in the other direction — a book that was actually about $10,600 down was displaying as roughly $2,100 up.

The fix for the first bug isn't "get better quotes." It's clamping any cost-to-close at the spread's own width and flagging the trade \`mark_suspect\` when that clamp fires — a mark that's provably wrong gets ignored for P&L math, on principle, in either direction: it can't inflate a loss and it can't hide one. The strike-breach stop is a deliberate exception — it still fires on a suspect mark, because that exit is keyed off where the stock is trading relative to the strike, not off the bad quote itself. Underneath both bugs, the real structural fix is \`assert_defined_risk\`, a single choke point every spread has to pass before it can open: no naked legs, no mismatched legs, no diagonals. Loss-boundedness now lives in what a position is allowed to be, not in whether a stop fires fast enough.

The lesson: a stop is a promise that something will happen later; a defined-risk structure is a fact that's already true. The BABA bug and the per-share bug were two different kinds of mistakes, caught by two different reviews, and both would have been structurally impossible if the position itself couldn't exceed its own defined risk in the first place.

What I'd do differently: build the assert-everywhere invariant before the sleeve went live, not after a bad quote made it necessary. It's a cheap check to write and an expensive one to have skipped.

Worth knowing if you're reading the dashboard closely: the source for this work sits on a local branch about 200 commits ahead of what's pushed to GitHub — the trades and the numbers on the live page are real, the commit history behind them isn't public yet.`,
    'build-log',
    '2026-08-08T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'the-app-stays-free-the-manual-is-19-99',
    `The App Stays Free, The Manual Is $19.99`,
    `Session Manager's marketing page said "Buy Now — $19.99" under the app itself, implying the free, MIT-licensed tool was the paid product. It wasn't. The manual is.`,
    `[Session Manager](/projects/session-manager/) is a free, MIT-licensed desktop cockpit for the \`claude\` CLI — multi-tab terminal, 25-plus configuration and observability tabs, an overnight job scheduler, voice dictation, all running on your own machine with zero telemetry. Its marketing page said "Buy Now — $19.99" directly under the app. The commit that fixed this admits it plainly: that page "led with the wrong offer and the wrong impression." A reader could look at that page and reasonably conclude the app itself cost money. It never has.

The actual answer: the app stays free, and the thing that's genuinely worth $19.99 is a real product now — the Field Manual, a maintained, versioned reference document. Buy it once through the existing Stripe checkout and you get lifetime access, either read online (one free sample chapter, the rest gated by purchase) or downloaded as offline HTML and PDF. It launched with 3 chapters and grew to 17 within the week as more of the app's own surface area got documented — no app-side feature gating was added anywhere; owning the manual doesn't unlock anything in the software, because there's nothing in the software to unlock.

The interesting engineering decision is how the download got secured, and then simplified. The first version used short-lived, HMAC-signed download tokens, because a plain browser link can't carry the auth header Clerk needs. That meant a \`MANUAL_DOWNLOAD_SECRET\` had to exist in production and stay identical across restarts — and when it wasn't set, it silently fell back to a random per-process key, which quietly broke every buyer's download link on the next deploy. The fix wasn't better secret management. It was removing the secret: the client now fetches the asset directly with its own bearer token and saves the blob in the browser, so the URL is never a credential and there's nothing left to expire or leak.

A second problem was closer to a real financial mistake. The code that matches a Stripe purchase to a product only checked env vars for direct Stripe prices, not for payment-link-only products. A new $5 "coffee tip" product, wired up purely as a payment link, would have matched nothing — and fallen through to a default case that, for other product shapes, issues a full paid license key. A $5 tip could have quietly granted a Pro license meant for a $19.99+ purchase. It was caught and logged before it shipped that way, not after.

What's next: the manual keeps getting rewritten in lockstep with the app — three point releases landed within days of launch just to keep pace with UI renames happening underneath it. That's the actual cost of an open-core product: the free thing keeps moving, and the paid thing has to keep up or it stops being honest.`,
    'product',
    '2026-08-11T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'the-bug-that-silently-killed-every-post',
    `The Bug That Silently Killed Every Post`,
    `Burrow's X posting ran on schedule for 11 days and published nothing, because the posting window and the post slots never actually overlapped. It's fixed now, and it's been quiet for a week since.`,
    `Burrow gathers Reddit, X, and Discord chatter for a downstream trading signal system, and this stretch was two separate reliability chases that both ended the same way — a cadence that looked fine on paper and wasn't.

The Reddit side ran three overlapping pipelines against a tiered coverage target: some of the 65 tracked trading subreddits every 4 hours, some every 8, some every 12. Nobody could point to what actually consumed the tier distinction downstream, and a \`pick()\` cap bug had quietly collapsed the real sweep to about 11 subreddits at steady state — 54 of 65 subs sitting at zero visits, coverage reading 16.9%. Both pipelines were retired and the whole thing became one daily full-universe sweep against one honest target: visited once every 24 hours. Simpler, and — this time — actually deliverable.

The X side was worse, because it failed silently. For 11 days, six scheduled posting sessions ran on time, every day, and published nothing. The root cause: scheduled posts only go out through a \`post_scheduled\` action inside a session run, and the post slots were hardcoded to 19:00 and 00:00 UTC. The actual active posting window was 09:00–11:00 UTC. Those times never overlapped. A post's only way out was a race against a 24-hour auto-expiry window, which historically won that race about 55% of the time by accident — until it didn't. Two specific queued posts expired in early August having made zero publish attempts. Reply success had its own version of the same failure: a stale account handle meant zero successful replies logged across 148 attempts over 30 days, while the system kept reporting the sessions as having run.

Neither of these threw an error. Both looked, from the outside, like a system doing its job on schedule. That's the pattern worth naming: a cadence bug doesn't crash, it just quietly does nothing, and the only way to catch it is to check the actual published output against the schedule, not the run logs. The fix pins the post-slot/window relationship together with a regression test, so the two can't drift back apart unnoticed the way they did the first time — nobody designed the fix that made it briefly work again, it was a side effect of a different, earlier commit widening the window; this time it's deliberate and locked in.

With that fixed, X moved to a tested, fixed 3x/day cadence — midnight, 6am, and noon PDT — with retry and diagnostics on the failures that are actually transient, and reply caps raised from 3/3/8 to a flat 10/10/10 with a weekly backstop of 70.

Worth saying plainly, in period: as of today, there's been no commit here in a week. That's not a verdict on why — just what's true right now, the same way the "0% reply success for 30 days" number was true before anyone looked at it. The live coverage scorecard reads 0.0% across all 65 subs this morning, which is what you'd expect from a pipeline that hasn't run recently, not necessarily a new problem.

This code isn't on GitHub — the local branch is 218 commits ahead of what's pushed, so there's nothing here to link to. Burrow doesn't have a tile on [/projects](/projects) either; it's infrastructure other projects consume, not something you'd visit directly.`,
    'build-log',
    '2026-08-15T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'siblings-can-now-see-their-own-bandwidth-bill',
    `Siblings Can Now See Their Own Bandwidth Bill`,
    `mcp-host's new usage_report tool lets any sibling project ask "how much am I actually costing?" — built after Bilko itself turned out to be its own biggest traffic source.`,
    `[mcp-host](https://github.com/StanislavBG/bilko-run/tree/main/mcp-host-server) — the MCP server that registers and publishes every static-path project on this site — can now answer a question no sibling project could ask itself before: how much bandwidth am I actually using? Any project wired to it can call a new \`usage_report\` tool and get its own per-project egress — bytes, requests, bytes-per-request — with no browser session or auth token required, where before that data only existed behind a Clerk-gated admin page a human had to open by hand.

The tool shipped honest about its own limits: numbers are a capacity signal, not a Render bill, they can under-report by up to a minute around a process restart, and one known attribution gap — some projects' own asset folders still get miscounted under the host's general bucket — is called out in the tool description rather than quietly left for someone to discover.

Also shipped: the platform found out it was generating a meaningful chunk of its own bill. A single page load was firing 26 CSP violation reports because the policy forbade things the site actually loads. Security nonces meant to lock down inline styles had been silently inert in production the whole time, because the static file server streams responses in a way that skipped the nonce-injection step — the site's own bundle was violating its own policy on every load. And an unlisted, "postponed" game project was still fully serving 116 MB of uncached sprite assets to every visitor, because nobody checks whether something hidden from the UI is still costing money. Compressing origin responses before they leave the server cut the biggest offender's real egress by roughly 8x — a snapshot endpoint that was billing 733 KB a request was only ever sending 93 KB over the wire.

The \`usage_report\` tool exists because none of that would have been visible without someone going and looking by hand — now a sibling can just ask.`,
    'build-log',
    '2026-08-19T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'epics-stopped-sharing-one-working-directory',
    `Epics Stopped Sharing One Working Directory`,
    `Session Manager's Epics — its unit of scheduled dev work — used to run concurrently against one shared checkout. Now each gets its own git worktree, and the tests that were supposed to prove it never actually ran.`,
    `I gave [Session Manager](/projects/session-manager/)'s Epics their own git worktrees this week. An Epic is the app's unit of scheduled dev work — a tagged session that owns its own PRDs and runs from proposed to active to completed. Before this, every concurrent Epic in a project ran against the same shared checkout, which meant two Epics editing at once could clobber each other's uncommitted changes or pick up half-finished edits from a sibling that happened to be running in the same directory at the same time.

The fix: each Epic now gets its own branch and checkout, created the moment it goes active. Terminal and Chat spawn into that isolated directory instead of the shared one. An explicit merge-to-main checkpoint folds the branch back in — attempted automatically on completion, but never blocking the Epic from archiving if the merge doesn't go clean — and a real conflict surfaces as a UI state with a resolve-in-terminal option, instead of silently corrupting whatever the shared directory used to be.

The part I want to write down is what happened when I went back to register the acceptance tests for the merge checkpoint. They existed — a whole file covering the fast-forward and real-conflict cases — but had never been added to the test runner's include list. Running the suite reported "no test files found" for that file. The core coverage for this feature had been dead code since the day it was written; it looked covered and wasn't. Registering it surfaced a second, smaller thing: a test asserting the code would \`reject\` with an error, when the actual code throws synchronously before the async path is ever reached. The assertion was wrong, not the code — but nobody would have known either way, because the test never ran.

Same day, three more edge cases turned up on their own: a relative project path silently resolving against the wrong working directory and writing five stray folders with no error at all; a worktree path saved from a previous session going stale after a reboot or a tmp-dir sweep and killing that Epic's terminal with an opaque error; and the anti-resurrection guard that's supposed to stop a job from running twice failing open on its first unreadable log file, which is exactly how this feature's own rollout PRD ended up running twice.

What's next: there's a per-project toggle now, in Settings, for anyone who wants Epics back on a shared directory — but the point of shipping it was to stop needing that toggle at all.`,
    'build-log',
    '2026-08-23T16:00:00.000Z',
  );

  await dbRun(
    `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
    'a-new-game-a-week-old-and-already-playable',
    `A New Game, A Week Old, Already Playable`,
    `A spaceship game started as an empty cosmos shader eight days ago. It's now a three-tier game with a real tutorial, six enemy types, and a deleted experiment worth explaining.`,
    `Eight days ago this was one commit: an ambient starfield and nebula shader in Godot, nothing else. It's now a real, three-tier game — a Universe Map of solar systems joined by warp lanes, each system a network of planets joined by transit lanes, and landing on a planet drops you into a 15-minute survivors-style combat run. A fresh save starts parked at Mercury inside an authored 8-planet tutorial ("Escape the Solar System") before the rest of the galaxy opens up; everywhere past Sol is deliberately locked off for now. Nine enemy archetypes, including six added this week, plus elite affixes and a boss fight, plus a meta-progression currency that upgrades your ship between runs.

The decision worth writing down: for one night in the middle of this build, the game had an AI design assistant built into it — a chat drawer that spawned a real, long-lived \`claude\` CLI process and streamed its output straight into the game's UI, meant to let you ask for design help without leaving the editor. It worked, with one very specific Godot gotcha: after the child process exits, Godot 4.7.2's pipe reader never flips its own "end of file" flag, so the code had to poll whether the process was still alive instead of trusting the pipe to tell it. It shipped, ran for a session, and then got deleted a week later. That's not a failure — trying an idea fast and cheap enough to also throw away fast and cheap is the actual point of building this way.

The honest admission: a spawn bug made the whole game look broken in a specific way — landing on a planet would either hang on a white screen forever or drop you into an empty arena with nothing in it. Two separate bugs were stacked on top of each other. One file failed to parse at all because an untyped array left a loop variable ambiguous, so the level loader silently loaded with nothing in it. Separately, the code that entered a level was calling into it in the same breath as adding it to the scene tree, racing ahead of Godot's own object initialization — so even a correctly-loaded level could still throw against a null reference. Both had to be found and fixed together; fixing either alone would have looked like it worked and wouldn't have.

Worth knowing: about 5 of the 96 commits this week were merged in directly from an autonomous scheduler running dev-work jobs against this repo, not typed by hand — the rest is manual. No tile on [/projects](/projects), and no GitHub remote at all yet; this one's entirely local for now.`,
    'build-log',
    '2026-08-27T16:00:00.000Z',
  );


  // Seed secret_metadata (idempotent — INSERT OR IGNORE, NULL last_rotated_at = never rotated)
  const SECRET_NAMES = [
    'STRIPE_API_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'GEMINI_API_KEY',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'TURSO_AUTH_TOKEN',
  ];
  const now = Math.floor(Date.now() / 1000);
  for (const name of SECRET_NAMES) {
    try {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO secret_metadata (name, last_rotated_at, notes, created_at) VALUES (?, NULL, ?, ?)',
        args: [name, 'seeded on PRD 29', now],
      });
    } catch { /* ignore */ }
  }

  console.log('[DB] Initialized' + (process.env.TURSO_DATABASE_URL ? ' (Turso)' : ' (local SQLite)'));
}

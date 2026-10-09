import { createClient, type Client, type InStatement, type Transaction } from '@libsql/client';
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
  // Audit trail for complimentary entitlements (see server/services/comp-grants.ts).
  // The entitlement itself lives in stripe_one_time_purchases — this table only
  // records who granted it and why, so a comp is never indistinguishable from a
  // sale after the fact. UNIQUE(email, product_key) makes re-granting an upsert.
  `CREATE TABLE IF NOT EXISTS comp_grants (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    product_key TEXT NOT NULL,
    reason TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER,
    revoked_by TEXT,
    UNIQUE(email, product_key)
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
  // Slowly-changing dimension, not an event stream: one row per install_id,
  // upserted on every app start. Keyed like usage_daily rather than logged like
  // funnel_events so "how many distinct installs ran version X" is a GROUP BY,
  // not a de-dup over an append-only table.
  `CREATE TABLE IF NOT EXISTS app_installs (
    install_id       TEXT PRIMARY KEY,
    app              TEXT NOT NULL,
    app_version      TEXT,
    platform         TEXT,
    os_release       TEXT,
    arch             TEXT,
    cpu_count        INTEGER,
    total_mem_mb     INTEGER,
    node_version     TEXT,
    electron_version TEXT,
    install_channel  TEXT,
    locale           TEXT,
    timezone         TEXT,
    first_seen_at    INTEGER NOT NULL,
    last_seen_at     INTEGER NOT NULL,
    seen_count       INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS idx_app_installs_app_last_seen ON app_installs (app, last_seen_at DESC)`,
  // Version rollups ("did the release I just shipped make things worse") scan
  // app_errors by app+version over a time window; without this they table-scan.
  `CREATE INDEX IF NOT EXISTS idx_app_errors_app_version_created ON app_errors (app, version, created_at DESC)`,
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
  // Session Manager relay paired devices (see server/sm-relay/tokens.ts). Long-lived
  // device tokens live here, not in-process, so a redeploy doesn't force every
  // desktop to re-pair. Only the SHA-256 of the token is stored; revocation deletes
  // the row. Times are epoch milliseconds.
  `CREATE TABLE IF NOT EXISTS sm_relay_devices (
    device_id      TEXT PRIMARY KEY,
    token_hash     TEXT NOT NULL UNIQUE,
    user_id        TEXT NOT NULL,
    email          TEXT NOT NULL,
    issued_at      INTEGER NOT NULL,
    expires_at     INTEGER NOT NULL,
    device_pub_key TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sm_relay_devices_user ON sm_relay_devices(user_id)`,
  // One row per one-shot data migration that has run (see
  // applyDataMigrationOnce). Schema changes stay in this array and the
  // additive ALTER list; this is for fixes to seeded rows that an admin may
  // edit afterwards, which must not be re-applied on the next boot.
  `CREATE TABLE IF NOT EXISTS data_migrations (
    id         TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
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
async function applyDataMigrationOnce(id: string, statements: InStatement[]): Promise<boolean> {
  const done = await dbGet<{ n: number }>('SELECT 1 AS n FROM data_migrations WHERE id = ?', id);
  if (done) return false;
  await getClient().batch(
    [
      ...statements,
      { sql: 'INSERT OR IGNORE INTO data_migrations (id, applied_at) VALUES (?, ?)', args: [id, Math.floor(Date.now() / 1000)] },
    ],
    'write',
  );
  return true;
}

/**
 * Applies each rewrite's title/excerpt/content once per post, keyed by its own
 * migrationId. Never touches slug, published_at, category or published, so a
 * sibling PRD rewriting one post can't collide with another's.
 */
export async function applyBlogRewrites(rewrites: BlogRewrite[]): Promise<void> {
  for (const r of rewrites) {
    await applyDataMigrationOnce(r.migrationId, [
      {
        sql: 'UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, updated_at = ? WHERE slug = ?',
        args: [r.title, r.excerpt, r.content, new Date().toISOString(), r.slug],
      },
    ]);
  }
}

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
    // Desktop apps (unlike browser apps, which are always "latest") sit on old
    // releases for months, so "did release X make usage worse" needs the version
    // as a real column. Appended last so existing INSERT column orders are
    // untouched; browser-app callers simply leave it NULL.
    'ALTER TABLE funnel_events ADD COLUMN version TEXT',
    'CREATE INDEX IF NOT EXISTS idx_funnel_events_tool_version ON funnel_events(tool, version)',
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
    // Work-state lifecycle, separate from moderation (visibility). status NULL
    // means 'open'. receipt_hash is sha256 of the one-time receipt handed to
    // the submitter, so they can look up status without any account.
    'ALTER TABLE project_feedback ADD COLUMN status TEXT',
    'ALTER TABLE project_feedback ADD COLUMN status_note TEXT',
    'ALTER TABLE project_feedback ADD COLUMN status_at INTEGER',
    'ALTER TABLE project_feedback ADD COLUMN receipt_hash TEXT',
    'CREATE INDEX IF NOT EXISTS idx_project_feedback_status ON project_feedback (slug, status_at)',
    // The install beacon collects no PII at all — the anonymous install UUID is
    // the entire identity model — so this column can only ever hold NULL. Dropped
    // rather than left in place: a column that can only be NULL invites someone
    // to start filling it. No-ops on a DB that never had it.
    'ALTER TABLE app_installs DROP COLUMN identify_email',
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
        args: [slug, DEFAULT_BUDGET_GZ_BYTES, Math.floor(Date.now() / 1000)],
      });
    } catch { /* ignore */ }
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
    try {
      await client.execute({
        sql: 'INSERT INTO app_budgets (slug, max_size_gz_bytes, updated_at) VALUES (?, ?, ?) '
           + 'ON CONFLICT(slug) DO UPDATE SET max_size_gz_bytes = ?, updated_at = ? '
           + 'WHERE app_budgets.max_size_gz_bytes < ?',
        args: [slug, limit, Math.floor(Date.now() / 1000), limit, Math.floor(Date.now() / 1000), limit],
      });
    } catch { /* ignore */ }
  }

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

  // Seed blog posts from content/blog/*.md (one file per post, ordered by frontmatter).
  // INSERT OR IGNORE never touches a row production already has; the one-shot
  // data migrations below carry corrections to existing rows.
  const seedPosts = loadBlogPosts();
  const insertPost = seedPosts.map(p => ({
    sql: `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [p.slug, p.title, p.excerpt, p.content, p.category, p.published ? 1 : 0, p.published_at],
  }));
  for (let i = 0; i < insertPost.length; i += 50) {
    await client.batch(insertPost.slice(i, i + 50), 'write');
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
  ]);

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
  ]);

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
  ]);

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
  );

  await applyBlogRewrites(BLOG_REWRITES);

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

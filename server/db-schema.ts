// Schema for server/db.ts. Add new tables (CREATE TABLE/INDEX IF NOT EXISTS) to MIGRATIONS below;
// additive columns on existing tables go in ADDITIVE_COLUMNS (applied only when missing).
// SQL here is applied verbatim at boot by initDb(); seeds and data fixes stay in db.ts.

export const MIGRATIONS = [
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

export const ADDITIVE_COLUMNS: Record<string, Array<[string, string]>> = {
  page_views: [
    ['email', 'TEXT'],
    ['utm_source', 'TEXT'],
    ['utm_medium', 'TEXT'],
    ['utm_campaign', 'TEXT'],
    ['utm_term', 'TEXT'],
    ['utm_content', 'TEXT'],
    ['visitor_id', 'TEXT'],
    ['session_id', 'TEXT'],
    ['is_new_visitor', 'INTEGER DEFAULT 0'],
    ['referrer_host', 'TEXT'],
    ['source_bucket', 'TEXT'],
    ['device', 'TEXT'],
    ['browser', 'TEXT'],
    ['os', 'TEXT'],
    ['is_bot', 'INTEGER DEFAULT 0'],
    ['is_admin', 'INTEGER DEFAULT 0'],
    ['created_at_ms', 'INTEGER'],
  ],
  funnel_events: [
    ['session_id', 'TEXT'],
    ['visitor_id', 'TEXT'],
    ['path', 'TEXT'],
    ['version', 'TEXT'],
  ],
  project_feedback: [
    ['parent_id', 'TEXT'],
    ['moderation_action', 'TEXT'],
    ['moderation_at', 'INTEGER'],
    ['moderation_reason', 'TEXT'],
    ['status', 'TEXT'],
    ['status_note', 'TEXT'],
    ['status_at', 'INTEGER'],
    ['receipt_hash', 'TEXT'],
  ],
};

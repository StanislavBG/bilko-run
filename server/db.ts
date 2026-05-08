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

  // Seed app_spend_ceilings for all paid tools (idempotent)
  const PAID_TOOL_SLUGS = [
    'stack-audit', 'launch-grader', 'page-roast',
    'ad-scorer', 'headline-grader', 'thread-grader',
    'email-forge', 'audience-decoder',
  ];
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

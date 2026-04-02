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

/** Reset the DB singleton — used in tests. */
export function _resetDbForTests(): void {
  if (_client) {
    _client.close();
    _client = null;
  }
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
  ]) {
    try { await client.execute(sql); } catch { /* column already exists */ }
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

  console.log('[DB] Initialized' + (process.env.TURSO_DATABASE_URL ? ' (Turso)' : ' (local SQLite)'));
}

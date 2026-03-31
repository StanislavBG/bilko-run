import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// On Render, use /tmp for writable SQLite (ephemeral but works)
const DB_PATH = process.env.CONTENTGRADE_DB_PATH ??
  (process.env.RENDER ? '/tmp/contentgrade.db' : resolve(__dirname, '../data/contentgrade.db'));

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    if (DB_PATH !== ':memory:') {
      mkdirSync(resolve(__dirname, '../data'), { recursive: true });
    }
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

/** Reset the DB singleton — used in tests to get a fresh in-memory DB. */
export function _resetDbForTests(): void {
  if (_db) {
    try { _db.close(); } catch {}
    _db = null;
  }
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_tracking (
      id INTEGER PRIMARY KEY,
      ip_hash TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(ip_hash, endpoint, date)
    );

    CREATE TABLE IF NOT EXISTS email_captures (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      tool TEXT NOT NULL,
      score TEXT NOT NULL DEFAULT '',
      ip_hash TEXT,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stripe_customers (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      stripe_customer_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stripe_subscriptions (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      stripe_customer_id TEXT NOT NULL,
      stripe_subscription_id TEXT NOT NULL UNIQUE,
      plan_tier TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stripe_one_time_purchases (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      stripe_customer_id TEXT NOT NULL,
      stripe_payment_intent_id TEXT NOT NULL UNIQUE,
      product_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS funnel_events (
      id INTEGER PRIMARY KEY,
      event TEXT NOT NULL,
      ip_hash TEXT,
      tool TEXT,
      email TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cli_telemetry (
      id INTEGER PRIMARY KEY,
      install_id TEXT NOT NULL,
      event TEXT NOT NULL,
      command TEXT,
      is_pro INTEGER,
      duration_ms INTEGER,
      success INTEGER,
      exit_code INTEGER,
      score REAL,
      content_type TEXT,
      version TEXT,
      platform TEXT,
      node_version TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_funnel_events_event ON funnel_events(event);
    CREATE INDEX IF NOT EXISTS idx_funnel_events_created ON funnel_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_cli_telemetry_install ON cli_telemetry(install_id);
    CREATE INDEX IF NOT EXISTS idx_cli_telemetry_command ON cli_telemetry(command);

    CREATE TABLE IF NOT EXISTS license_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      stripe_customer_id TEXT,
      product_key TEXT NOT NULL DEFAULT 'contentgrade_pro',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_validated_at DATETIME,
      validation_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
    CREATE INDEX IF NOT EXISTS idx_license_keys_email ON license_keys(email);

    CREATE TABLE IF NOT EXISTS token_balances (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS token_transactions (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      stripe_payment_intent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_token_balances_email ON token_balances(email);
    CREATE INDEX IF NOT EXISTS idx_token_transactions_email ON token_transactions(email);

    CREATE TABLE IF NOT EXISTS social_roast_rivals (
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
    );

    CREATE TABLE IF NOT EXISTS roast_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      roast TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_roasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      url TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      roast TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_roasts_email ON user_roasts(email);

    CREATE TABLE IF NOT EXISTS social_roast_queue (
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
    );
  `);

  // Additive migrations for existing DBs (safe to re-run — fails silently if column exists)
  try { db.exec(`ALTER TABLE cli_telemetry ADD COLUMN is_pro INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE cli_telemetry ADD COLUMN run_count_bucket TEXT`); } catch {}
  try { db.exec(`ALTER TABLE cli_telemetry ADD COLUMN tier TEXT`); } catch {}
  try { db.exec(`ALTER TABLE cli_telemetry ADD COLUMN run_count INTEGER`); } catch {}
  // Preflight Suite: identify which tool sent the ping
  try { db.exec(`ALTER TABLE cli_telemetry ADD COLUMN package TEXT`); } catch {}
  // Conversion funnel: outcome label (pass/fail/error/rate_limited/activate/upgrade_shown)
  try { db.exec(`ALTER TABLE cli_telemetry ADD COLUMN outcome TEXT`); } catch {}

  // Seed Wall of Shame with sample roasts (only if empty)
  const count = db.prepare('SELECT COUNT(*) as n FROM roast_history').get() as { n: number };
  if (count.n === 0) {
    const seeds = [
      ['stripe.com', 62, 'C+', "Stripe's landing page is so comprehensive, it's practically a textbook — and just as exciting to read."],
      ['example.com', 15, 'F', "This page has the conversion power of a 'Please take one' sign at a dentist's office."],
      ['shopify.com', 78, 'B+', "Shopify's page sells the dream of entrepreneurship while burying the pricing like a prenup."],
      ['notion.so', 71, 'B', "Notion's landing page is clean, minimal, and about as urgent as a Sunday afternoon nap."],
      ['linear.app', 85, 'A', "Linear's site is so well-designed it makes you feel bad about your own product before you even sign up."],
      ['vercel.com', 74, 'B', "Vercel's hero section deploys faster than their actual deploys. The rest of the page is still loading."],
    ];
    const insert = db.prepare('INSERT INTO roast_history (url, score, grade, roast) VALUES (?, ?, ?, ?)');
    for (const [url, score, grade, roast] of seeds) {
      insert.run(url, score, grade, roast);
    }
  }
}

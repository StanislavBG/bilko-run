/**
 * Test DB helper — creates an isolated in-memory SQLite instance for each test
 * that uses the same schema as production but doesn't touch the real data file.
 */
import Database from 'better-sqlite3';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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
  `);

  return db;
}

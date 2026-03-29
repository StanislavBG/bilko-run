/**
 * Unit tests for rate limiting logic.
 * Tests the usage tracking functions and rate limit enforcement
 * using an in-memory SQLite instance.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../helpers/db.js';

// ── Extracted rate-limit logic (mirrors demos.ts exactly) ──────────────────

const FREE_TIER_LIMIT = 3;
const PRO_TIER_LIMIT = 20;

function getUsageCount(db: Database.Database, ipHash: string, endpoint: string, date: string): number {
  const row = db.prepare(
    'SELECT count FROM usage_tracking WHERE ip_hash = ? AND endpoint = ? AND date = ?'
  ).get(ipHash, endpoint, date) as { count: number } | undefined;
  return row?.count ?? 0;
}

function incrementUsage(db: Database.Database, ipHash: string, endpoint: string, date: string): number {
  db.prepare(`
    INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(ip_hash, endpoint, date) DO UPDATE SET count = count + 1
  `).run(ipHash, endpoint, date);
  return getUsageCount(db, ipHash, endpoint, date);
}

function resetUsage(db: Database.Database, ipHash: string, endpoint: string, date: string): void {
  db.prepare(
    'INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, 0) ON CONFLICT(ip_hash, endpoint, date) DO UPDATE SET count = 0'
  ).run(ipHash, endpoint, date);
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  isPro: boolean;
}

function checkRateLimitSync(
  db: Database.Database,
  ipHash: string,
  endpoint: string,
  date: string,
  isPro = false
): RateLimitResult {
  const limit = isPro ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
  const count = getUsageCount(db, ipHash, endpoint, date);
  if (count >= limit) {
    return { allowed: false, remaining: 0, limit, isPro };
  }
  return { allowed: true, remaining: limit - count, limit, isPro };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('rate limiting — free tier', () => {
  let db: Database.Database;
  const IP = 'test-ip-hash-abc';
  const ENDPOINT = 'headline-grader';
  const DATE = '2026-03-20';

  beforeEach(() => {
    db = createTestDb();
  });

  it('allows first request', () => {
    const result = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(FREE_TIER_LIMIT);
    expect(result.limit).toBe(FREE_TIER_LIMIT);
    expect(result.isPro).toBe(false);
  });

  it('allows up to FREE_TIER_LIMIT requests', () => {
    for (let i = 0; i < FREE_TIER_LIMIT; i++) {
      const result = checkRateLimitSync(db, IP, ENDPOINT, DATE);
      expect(result.allowed).toBe(true);
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
  });

  it('blocks after FREE_TIER_LIMIT requests', () => {
    for (let i = 0; i < FREE_TIER_LIMIT; i++) {
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
    const result = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks remaining count correctly', () => {
    incrementUsage(db, IP, ENDPOINT, DATE);
    const result = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    expect(result.remaining).toBe(FREE_TIER_LIMIT - 1);

    incrementUsage(db, IP, ENDPOINT, DATE);
    const result2 = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    expect(result2.remaining).toBe(FREE_TIER_LIMIT - 2);
  });

  it('different IPs have independent limits', () => {
    const IP_B = 'different-ip-hash-xyz';
    for (let i = 0; i < FREE_TIER_LIMIT; i++) {
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
    // IP exhausted, IP_B should still be allowed
    const resultA = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    const resultB = checkRateLimitSync(db, IP_B, ENDPOINT, DATE);
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it('different endpoints have independent limits', () => {
    const ENDPOINT_B = 'page-roast';
    for (let i = 0; i < FREE_TIER_LIMIT; i++) {
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
    // headline exhausted, page-roast should still be allowed
    const resultA = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    const resultB = checkRateLimitSync(db, IP, ENDPOINT_B, DATE);
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it('daily reset: yesterday usage does not count toward today', () => {
    const YESTERDAY = '2026-03-19';
    for (let i = 0; i < FREE_TIER_LIMIT; i++) {
      incrementUsage(db, IP, ENDPOINT, YESTERDAY);
    }
    // Today should have fresh limit
    const result = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(FREE_TIER_LIMIT);
  });

  it('reset usage sets count back to 0', () => {
    for (let i = 0; i < FREE_TIER_LIMIT; i++) {
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
    resetUsage(db, IP, ENDPOINT, DATE);
    const result = checkRateLimitSync(db, IP, ENDPOINT, DATE);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(FREE_TIER_LIMIT);
  });
});

describe('rate limiting — pro tier', () => {
  let db: Database.Database;
  const IP = 'pro-user-ip-hash';
  const ENDPOINT = 'headline-grader';
  const DATE = '2026-03-20';

  beforeEach(() => {
    db = createTestDb();
  });

  it('allows PRO_TIER_LIMIT requests', () => {
    for (let i = 0; i < PRO_TIER_LIMIT - 1; i++) {
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
    const result = checkRateLimitSync(db, IP, ENDPOINT, DATE, true);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(PRO_TIER_LIMIT);
  });

  it('blocks after PRO_TIER_LIMIT requests', () => {
    for (let i = 0; i < PRO_TIER_LIMIT; i++) {
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
    const result = checkRateLimitSync(db, IP, ENDPOINT, DATE, true);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('free user blocked at 3, pro user still allowed at same IP', () => {
    for (let i = 0; i < FREE_TIER_LIMIT; i++) {
      incrementUsage(db, IP, ENDPOINT, DATE);
    }
    const freeResult = checkRateLimitSync(db, IP, ENDPOINT, DATE, false);
    const proResult  = checkRateLimitSync(db, IP, ENDPOINT, DATE, true);
    expect(freeResult.allowed).toBe(false);
    expect(proResult.allowed).toBe(true);
  });
});

describe('usage tracking — persistence', () => {
  let db: Database.Database;
  const IP = 'persist-test-ip';
  const ENDPOINT = 'ad-scorer';
  const DATE = '2026-03-20';

  beforeEach(() => {
    db = createTestDb();
  });

  it('increment returns new count', () => {
    expect(incrementUsage(db, IP, ENDPOINT, DATE)).toBe(1);
    expect(incrementUsage(db, IP, ENDPOINT, DATE)).toBe(2);
    expect(incrementUsage(db, IP, ENDPOINT, DATE)).toBe(3);
  });

  it('count starts at 0 for new IP/endpoint/date', () => {
    expect(getUsageCount(db, IP, ENDPOINT, DATE)).toBe(0);
  });

  it('multiple tools tracked independently', () => {
    const tools = ['headline-grader', 'page-roast', 'ad-scorer', 'thread-grader', 'email-forge', 'audience-decoder'];
    for (const tool of tools) {
      incrementUsage(db, IP, tool, DATE);
      incrementUsage(db, IP, tool, DATE);
    }
    for (const tool of tools) {
      expect(getUsageCount(db, IP, tool, DATE)).toBe(2);
    }
  });
});

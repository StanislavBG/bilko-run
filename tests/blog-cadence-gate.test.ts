import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findSpacingViolations,
  loadSeededPosts,
  nextAllowedSlot,
  type SeededPost,
} from '../scripts/blog-cadence-gate.js';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SINCE = '2026-10-01T00:00:00.000Z';

describe('findSpacingViolations', () => {
  it('flags a same-day pair', () => {
    const posts: SeededPost[] = [
      { slug: 'a', publishedAt: '2026-10-03T16:08:00.000Z' },
      { slug: 'b', publishedAt: '2026-10-03T17:26:00.000Z' },
    ];
    const violations = findSpacingViolations(posts, 3, SINCE);
    expect(violations).toEqual([{ earlier: 'a', later: 'b', gapHours: expect.closeTo(1.3, 1) }]);
  });

  it('allows a pair exactly 3 days apart', () => {
    const posts: SeededPost[] = [
      { slug: 'a', publishedAt: '2026-10-05T00:00:00.000Z' },
      { slug: 'b', publishedAt: '2026-10-08T00:00:00.000Z' },
    ];
    expect(findSpacingViolations(posts, 3, SINCE)).toEqual([]);
  });

  it('ignores pairs whose later post is before the enforcement cutoff', () => {
    const posts: SeededPost[] = [
      { slug: 'a', publishedAt: '2026-09-01T00:00:00.000Z' },
      { slug: 'b', publishedAt: '2026-09-01T01:00:00.000Z' },
    ];
    expect(findSpacingViolations(posts, 3, SINCE)).toEqual([]);
  });

  it('sorts unsorted input before comparing adjacent pairs', () => {
    const posts: SeededPost[] = [
      { slug: 'b', publishedAt: '2026-10-03T17:26:00.000Z' },
      { slug: 'a', publishedAt: '2026-10-03T16:08:00.000Z' },
      { slug: 'c', publishedAt: '2026-10-10T00:00:00.000Z' },
    ];
    const violations = findSpacingViolations(posts, 3, SINCE);
    expect(violations).toHaveLength(1);
    expect(violations[0].earlier).toBe('a');
    expect(violations[0].later).toBe('b');
  });

  it('returns no violations for an empty list', () => {
    expect(findSpacingViolations([], 3, SINCE)).toEqual([]);
  });
});

describe('nextAllowedSlot', () => {
  it('returns now for an empty post list', () => {
    const now = new Date('2026-10-10T00:00:00.000Z');
    expect(nextAllowedSlot([], 3, now)).toBe(now.toISOString());
  });

  it('returns latest + 3 days for a recent post', () => {
    const now = new Date('2026-10-10T00:00:00.000Z');
    const posts: SeededPost[] = [{ slug: 'a', publishedAt: '2026-10-09T00:00:00.000Z' }];
    expect(nextAllowedSlot(posts, 3, now)).toBe('2026-10-12T00:00:00.000Z');
  });

  it('returns now for an old post whose gap has already elapsed', () => {
    const now = new Date('2026-10-10T00:00:00.000Z');
    const posts: SeededPost[] = [{ slug: 'a', publishedAt: '2026-01-01T00:00:00.000Z' }];
    expect(nextAllowedSlot(posts, 3, now)).toBe(now.toISOString());
  });
});

describe('blog seed published_at values are frozen literals', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never seeds a published post whose published_at carries the current clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2099-01-01T00:00:00.000Z'));

    try {
      vi.resetModules();
      const fresh = await import('../scripts/blog-cadence-gate.js');
      const posts = await fresh.loadSeededPosts();
      expect(posts.length).toBeGreaterThan(0);
      for (const post of posts) {
        expect(post.publishedAt.startsWith('2099-')).toBe(false);
      }
    } finally {
      vi.useRealTimers();
    }
  }, 60_000);
});

describe('loadSeededPosts env restoration', () => {
  it('restores TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and BILKO_SQLITE_PATH to their sentinel values', async () => {
    const savedEnv = {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
      BILKO_SQLITE_PATH: process.env.BILKO_SQLITE_PATH,
    };

    process.env.TURSO_DATABASE_URL = 'sentinel-turso-url';
    process.env.TURSO_AUTH_TOKEN = 'sentinel-turso-token';
    process.env.BILKO_SQLITE_PATH = 'sentinel-sqlite-path';

    try {
      const posts = await loadSeededPosts();
      expect(posts.length).toBeGreaterThan(0);
      expect(process.env.TURSO_DATABASE_URL).toBe('sentinel-turso-url');
      expect(process.env.TURSO_AUTH_TOKEN).toBe('sentinel-turso-token');
      expect(process.env.BILKO_SQLITE_PATH).toBe('sentinel-sqlite-path');
    } finally {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) {
          delete process.env[key as keyof typeof savedEnv];
        } else {
          process.env[key as keyof typeof savedEnv] = value;
        }
      }
    }
  }, 60_000);
});

describe('next-slot CLI stdout contract', () => {
  it('next-slot prints exactly one ISO line on stdout (DB boot log must not leak into it)', () => {
    const env = { ...process.env };
    delete env.TURSO_DATABASE_URL;
    delete env.TURSO_AUTH_TOKEN;

    const result = spawnSync('pnpm', ['tsx', 'scripts/blog-cadence-gate.ts', 'next-slot'], {
      cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
      env,
      encoding: 'utf-8',
      timeout: 120_000,
    });

    expect(result.status).toBe(0);
    const stdout = result.stdout.trim();
    expect(stdout.split('\n')).toHaveLength(1);
    expect(stdout).toMatch(/^\d{4}-\d{2}-\d{2}T[^\s]*Z$/);
  }, 130_000);
});

describe('seeded posts obey the cadence gate', () => {
  it('has no spacing violations among seeded posts', async () => {
    const posts = await loadSeededPosts();
    expect(findSpacingViolations(posts, 3, SINCE)).toEqual([]);
  }, 60_000);

  it('seeds the OutdoorHours post at the rescheduled date', async () => {
    const posts = await loadSeededPosts();
    const outdoorHours = posts.find(
      p => p.slug === 'twelve-places-one-weather-rule-you-set-yourself',
    );
    expect(outdoorHours?.publishedAt).toBe('2026-10-07T16:00:00.000Z');
  }, 60_000);
});

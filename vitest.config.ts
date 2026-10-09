import { defineConfig } from 'vitest/config';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// libsql's sqlite3 client reopens the connection after a transaction, which
// would wipe a ':memory:' DB, so use a unique throwaway file instead.
const testDbPath = join(mkdtempSync(join(tmpdir(), 'bilko-vitest-')), 'test.db');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      // Isolated throwaway DB; never the dev's data/contentgrade.db or Turso.
      BILKO_SQLITE_PATH: testDbPath,
      TURSO_DATABASE_URL: '',
    },
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
    // Run tests sequentially to avoid SQLite concurrency issues
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Per-file throwaway DB (a file, not ':memory:': libsql's sqlite3 client
    // reopens the connection after a transaction, which would wipe ':memory:').
    setupFiles: ['tests/setup-db.ts'],
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

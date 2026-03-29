import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      CONTENTGRADE_DB_PATH: ':memory:',
    },
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts', 'bin/**/*.js'],
      reporter: ['text', 'lcov'],
    },
    // Run tests sequentially to avoid SQLite concurrency issues
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});

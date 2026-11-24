import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildAssetVersions } from './shared/asset-versions';

// Content versions for /projects card images and listing assets, computed once from the
// registry + public/ bytes being built (Vite copies public/ into dist/ byte for byte, so
// this matches the server's og:image v=). Read by src/data/assetVersions.ts.
const ASSET_VERSIONS = buildAssetVersions(
  JSON.parse(readFileSync(resolve(__dirname, 'src/data/standalone-projects.json'), 'utf8')) as Record<string, unknown>[],
  resolve(__dirname, 'public'),
);

export default defineConfig({
  define: {
    '__ASSET_VERSIONS__': JSON.stringify(ASSET_VERSIONS),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Per-file throwaway DB (a file, not ':memory:': libsql's sqlite3 client
    // reopens the connection after a transaction, which would wipe ':memory:').
    setupFiles: ['tests/setup-db.ts', 'tests/setup-timers.ts'],
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

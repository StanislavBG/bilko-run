import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Every test file gets its own throwaway SQLite file. With one shared file, a
// write still in flight from the previous file (unawaited usage writes, clients
// orphaned by vi.resetModules) made the next file's initDb batch fail with
// SQLITE_BUSY: database is locked. Never the dev's data/contentgrade.db or Turso.
process.env.BILKO_SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'bilko-vitest-')), 'test.db');
process.env.TURSO_DATABASE_URL = '';

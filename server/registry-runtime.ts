// In-memory project registry for the server. Bilko-DB (bilko_db_projects) is the source; at
// boot initRegistry first imports src/data/standalone-projects.json while that file is still the
// writer (importRegistryFile is a no-op once the API has written), then loads every entry.
// Readers call getRegistrySnapshot() synchronously; writers call refreshRegistry() after a
// change, and onRegistryChange listeners hear about every snapshot whose content changed.
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { RegistryProject } from '../mcp-host-server/src/contract/registry.js';
import { importRegistryFile, listProjects } from './services/registry-db.js';

export type RegistryListener = (snapshot: readonly RegistryProject[]) => void;

const REGISTRY_FILE = 'src/data/standalone-projects.json';
const IMPORT_ACTOR = 'boot:file-import';

let snapshot: readonly RegistryProject[] = Object.freeze([]);
let snapshotJson = '[]';
const listeners = new Set<RegistryListener>();

/** The registry file, wherever the server runs from (repo root in dev, dist-server in prod). */
export function findRegistryFile(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), REGISTRY_FILE),
    resolve(here, '..', REGISTRY_FILE),
    resolve(here, '..', '..', REGISTRY_FILE),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Every registry entry in registry order. Synchronous; empty until initRegistry has run. */
export function getRegistrySnapshot(): RegistryProject[] {
  // Frozen: readers share one array, so a mutation would leak into every other reader.
  return snapshot as RegistryProject[];
}

/** Subscribe to snapshot changes. Returns the unsubscribe function. */
export function onRegistryChange(listener: RegistryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reload the snapshot from Bilko-DB. Listeners run only when the content changed; a listener
 * that throws is logged and does not stop the others.
 */
export async function refreshRegistry(): Promise<readonly RegistryProject[]> {
  const next = await listProjects();
  const json = JSON.stringify(next);
  if (json === snapshotJson) return snapshot;
  snapshot = Object.freeze(next);
  snapshotJson = json;
  for (const listener of [...listeners]) {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('[Registry] change listener failed:', err);
    }
  }
  return snapshot;
}

/**
 * Boot: import the registry file when it exists (file: null skips it; tests pass a path), then
 * load Bilko-DB into memory. An invalid file is logged and the DB's current rows are used.
 */
export async function initRegistry(opts: { file?: string | null } = {}): Promise<readonly RegistryProject[]> {
  const file = opts.file === undefined ? findRegistryFile() : opts.file;
  if (file && existsSync(file)) {
    try {
      const result = await importRegistryFile(readFileSync(file, 'utf-8'), IMPORT_ACTOR);
      if (result === 'imported') console.log(`[Registry] imported ${file} into Bilko-DB`);
    } catch (err) {
      console.error(`[Registry] import of ${file} failed; keeping the Bilko-DB registry:`, err);
    }
  }
  const loaded = await refreshRegistry();
  if (loaded.length === 0) {
    console.warn('[Registry] Bilko-DB registry is empty; serving no projects');
  }
  return loaded;
}

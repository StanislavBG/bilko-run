/**
 * Where the bilko-host MCP's read tools get the registry from: bilko.run's
 * GET /api/admin/registry (Bilko-DB). No git command runs.
 */

import { readRegistry, type RegistryApiEntry } from './registry-api.js';

/** Legacy path of the registry file; write tools still commit to it until they move to the API. */
export const REGISTRY_PATH = 'src/data/standalone-projects.json';

export interface RegistrySourceOptions {
  /** Test seam: replaces the API call. */
  read?: () => Promise<RegistryApiEntry[]>;
}

export interface RegistrySource {
  /** JSON array of entries, same shape the registry file had. */
  raw: string;
  source: 'api';
  ref: string;
  /** slug -> version, for optimistic writes. */
  versions: Record<string, number>;
  entries: RegistryApiEntry[];
}

// hostRoot is kept so existing callers need no change; the API does not use it.
export async function readLatestRegistryRaw(
  _hostRoot?: string,
  opts: RegistrySourceOptions = {},
): Promise<RegistrySource> {
  const entries = await (opts.read ?? readRegistry)();
  const versions: Record<string, number> = {};
  for (const e of entries) versions[String(e.entry.slug)] = e.version;
  return {
    raw: JSON.stringify(entries.map((e) => e.entry), null, 2) + '\n',
    source: 'api',
    ref: '/api/admin/registry',
    versions,
    entries,
  };
}

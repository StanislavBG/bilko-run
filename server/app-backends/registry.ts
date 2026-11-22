/**
 * Reads the deployed registry (src/data/standalone-projects.json) for app-backend forwarding.
 * Same candidate paths as loadOgProjects in server/og-meta.ts (cwd, then the repo root, then
 * dist-server/); this module sits one folder deeper, hence the extra '..'. Never throws: a missing file,
 * invalid JSON or a non-array gives [] and one warning.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadDeployedRegistry(
  file?: string,
  warn: (msg: string) => void = (m) => console.warn(m),
): unknown[] {
  const rel = 'src/data/standalone-projects.json';
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = file
    ? [file]
    : [resolve(process.cwd(), rel), resolve(here, '..', '..', '..', rel), resolve(here, '..', '..', rel)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    warn(`[app-backends] registry not found; tried ${candidates.join(', ')}`);
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(found, 'utf-8'));
  } catch (err) {
    warn(`[app-backends] registry ${found} unreadable: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
  if (!Array.isArray(parsed)) {
    warn(`[app-backends] registry ${found} is not an array`);
    return [];
  }
  return parsed;
}

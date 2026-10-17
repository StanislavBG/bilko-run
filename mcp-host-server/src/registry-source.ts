/**
 * Where the bilko-host MCP's read tools get the registry from.
 *
 * Writes always land on <remote>/<branch> via the publish checkout, but the
 * human's main checkout (HOST_ROOT) only moves when someone pulls. Reading
 * HOST_ROOT's working tree therefore hid every listing pushed since the last
 * pull. Reads go to <remote>/<branch> instead, falling back to the working
 * tree only when git can't answer (offline, no remote).
 *
 * Pure git/fs module: no MCP SDK.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const exec = promisify(execFile);

export const REGISTRY_PATH = 'src/data/standalone-projects.json';
const FETCH_TIMEOUT_MS = 20 * 1000;
const SHOW_TIMEOUT_MS = 10 * 1000;

export interface RegistrySourceOptions {
  remote?: string;
  branch?: string;
}

export type RegistrySource =
  | { raw: string; source: 'remote'; ref: string }
  | { raw: string; source: 'local'; ref: string; reason: string };

export async function readLatestRegistryRaw(
  hostRoot: string,
  opts: RegistrySourceOptions = {},
): Promise<RegistrySource> {
  const remote = opts.remote ?? 'origin';
  const branch = opts.branch ?? 'main';
  const ref = `${remote}/${branch}`;
  try {
    // Updates refs/remotes only; never touches the caller's HEAD, index or tree.
    await exec('git', ['fetch', '--quiet', remote, branch], { cwd: hostRoot, timeout: FETCH_TIMEOUT_MS });
  } catch {
    // Offline: the last fetched remote ref is still fresher than the working tree.
  }
  try {
    const { stdout } = await exec('git', ['show', `${ref}:${REGISTRY_PATH}`], {
      cwd: hostRoot,
      timeout: SHOW_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { raw: stdout, source: 'remote', ref };
  } catch (e: unknown) {
    const raw = await readFile(resolve(hostRoot, REGISTRY_PATH), 'utf8');
    return { raw, source: 'local', ref: resolve(hostRoot, REGISTRY_PATH), reason: (e as Error).message };
  }
}

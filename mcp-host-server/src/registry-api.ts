/**
 * Client for bilko.run's registry API (Bilko-DB). Reads use the read-only admin key
 * (BILKO_ADMIN_KEY or the admin-key file); writes use the owner's 'registry' key
 * (BILKO_REGISTRY_KEY, else BILKO_REGISTRY_KEY_FILE, else ~/.config/bilko-host/registry-key).
 * Keys are never logged or included in error text.
 */

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveAdminKey } from './errors-report.js';

const TIMEOUT_MS = 15_000;

export interface RegistryApiEntry {
  entry: Record<string, unknown>;
  version: number;
}

export function registryHostUrl(): string {
  return (process.env.BILKO_HOST_URL || 'https://bilko.run').replace(/\/+$/, '');
}

export function registryKeyPath(): string {
  return process.env.BILKO_REGISTRY_KEY_FILE || join(homedir(), '.config', 'bilko-host', 'registry-key');
}

export function resolveRegistryKey(): string {
  const env = process.env.BILKO_REGISTRY_KEY?.trim();
  if (env) return env;
  const path = registryKeyPath();
  const missing = () =>
    new Error(
      `BILKO_REGISTRY_KEY is not set and no key file at ${path} — the owner mints a registry-scope key at https://bilko.run/admin/secrets; set BILKO_REGISTRY_KEY or write it to that file with mode 0600`,
    );
  let mode: number;
  try {
    mode = statSync(path).mode;
  } catch {
    throw missing();
  }
  if (mode & 0o077) {
    throw new Error(`${path} is readable by other users (mode ${(mode & 0o777).toString(8)}) — run: chmod 600 ${path}`);
  }
  const key = readFileSync(path, 'utf8').trim();
  if (!key) throw missing();
  return key;
}

async function apiError(what: string, res: Response, key: string): Promise<Error> {
  let code = '';
  try {
    const text = (await res.text()).replaceAll(key, '[redacted]');
    try {
      const body = JSON.parse(text) as { error?: unknown; issues?: unknown };
      code = typeof body.error === 'string' ? body.error : '';
      if (Array.isArray(body.issues) && body.issues.length) code += `: ${body.issues.join('; ')}`;
    } catch {
      code = text.slice(0, 200);
    }
  } catch {
    // no body
  }
  return new Error(`${what} failed: HTTP ${res.status}${code ? ` ${code}` : ''}`);
}

async function call(what: string, key: string, path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${registryHostUrl()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e: unknown) {
    throw new Error(`${what} failed: request error: ${(e as Error).message.replaceAll(key, '[redacted]')}`);
  }
  if (!res.ok) throw await apiError(what, res, key);
  return res;
}

/** GET /api/admin/registry: every entry with its version. */
export async function readRegistry(): Promise<RegistryApiEntry[]> {
  const key = resolveAdminKey();
  const res = await call('registry read', key, '/api/admin/registry', { method: 'GET' });
  const body = (await res.json()) as { projects?: RegistryApiEntry[] };
  return body.projects ?? [];
}

export async function putRegistryProject(
  entry: { slug: string } & Record<string, unknown>,
  ifVersion?: number,
): Promise<{ slug: string; version: number }> {
  const key = resolveRegistryKey();
  const payload: Record<string, unknown> = { entry };
  if (ifVersion !== undefined) payload.ifVersion = ifVersion;
  const res = await call(`registry put "${entry.slug}"`, key, `/api/admin/registry/${encodeURIComponent(entry.slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as { slug: string; version: number };
}

export async function deleteRegistryProject(slug: string, ifVersion?: number): Promise<{ ok: true }> {
  const key = resolveRegistryKey();
  const q = ifVersion !== undefined ? `?ifVersion=${ifVersion}` : '';
  const res = await call(`registry delete "${slug}"`, key, `/api/admin/registry/${encodeURIComponent(slug)}${q}`, {
    method: 'DELETE',
  });
  return (await res.json()) as { ok: true };
}

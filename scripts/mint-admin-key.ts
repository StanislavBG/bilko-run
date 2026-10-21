// Agent-side admin key provisioning: mints a read-only `bka_` key straight into the production
// DB (no browser), rotates the previous key with the same label, and optionally installs it at
// ~/.config/bilko-host/admin-key. The raw key is only ever written to the key file, never printed.
//
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... pnpm admin-key:mint --install
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ADMIN_EMAILS } from '../server/clerk.js';
import { dbGet } from '../server/db.js';
import { listAdminApiKeys, mintAdminApiKey, revokeAdminApiKey } from '../server/services/admin-api-keys.js';

export const DEFAULT_LABEL = 'bilko-host-mcp@pop-os';
export const DEFAULT_TTL_DAYS = 365;

export interface MintOptions {
  email?: string;
  label?: string;
  ttlDays?: number;
}

export interface MintResult {
  key: string;
  prefix: string;
  expiresAt: number;
  email: string;
  label: string;
  revokedIds: number[];
}

export function defaultKeyPath(): string {
  return process.env.BILKO_ADMIN_KEY_FILE || join(homedir(), '.config', 'bilko-host', 'admin-key');
}

/** Mint first, then revoke older live keys with the same label, so a failed mint never leaves no key. */
export async function mintAndRotate(opts: MintOptions = {}): Promise<MintResult> {
  const email = (opts.email ?? ADMIN_EMAILS[0]).toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) throw new Error(`${email} is not in ADMIN_EMAILS`);
  const label = opts.label ?? DEFAULT_LABEL;
  const minted = await mintAdminApiKey(email, label, opts.ttlDays ?? DEFAULT_TTL_DAYS);
  const revokedIds: number[] = [];
  for (const k of await listAdminApiKeys(email)) {
    if (k.id === minted.id || k.label !== label || k.revoked_at !== null) continue;
    if (await revokeAdminApiKey(k.id, email)) revokedIds.push(k.id);
  }
  return { key: minted.key, prefix: minted.prefix, expiresAt: minted.expiresAt, email, label, revokedIds };
}

/** Write the key to `path` with dir 0700 / file 0600. */
export function installKeyFile(key: string, path: string = defaultKeyPath()): string {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, key + '\n', { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

/** Refuse to run against anything but a remote DB that has the admin_api_keys table. */
export async function assertProdDb(): Promise<void> {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set — a key minted in a local SQLite DB will not authenticate against bilko.run');
  }
  const row = await dbGet<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_api_keys'");
  if (!row) throw new Error('admin_api_keys table not found — this does not look like the production DB');
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv: string[]): Promise<void> {
  await assertProdDb();
  const ttl = arg(argv, '--ttl-days');
  const r = await mintAndRotate({ email: arg(argv, '--email'), label: arg(argv, '--label'), ttlDays: ttl ? Number(ttl) : undefined });
  const lines = [
    `minted ${r.prefix}… for ${r.email} (label ${r.label})`,
    `expires ${new Date(r.expiresAt * 1000).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' })}`,
    `revoked previous keys: ${r.revokedIds.length ? r.revokedIds.join(', ') : 'none'}`,
  ];
  if (argv.includes('--install')) lines.push(`installed ${installKeyFile(r.key)} (0600)`);
  else lines.push('not installed — re-run with --install (the raw key is never printed)');
  console.log(lines.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A Vite plugin with no hooks. It is structurally a Vite `Plugin`, so host-kit needs no vite dependency. */
export interface HostKitVitePlugin {
  name: string;
  apply: 'serve';
}

/** Every file under `dir`, as `/`-separated paths relative to it. */
function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? listFiles(dir, rel) : [rel];
  });
}

/**
 * A plugin whose name carries a fingerprint of the package at `pkgDir`: its
 * package.json and every file under dist/. Vite hashes plugin names into the
 * config hash that keys node_modules/.vite, so a changed package is re-bundled
 * on the next dev start and an unchanged one keeps the cache.
 */
export function fingerprintPlugin(pkgDir: string): HostKitVitePlugin {
  try {
    const pkg = readFileSync(join(pkgDir, 'package.json'));
    const hash = createHash('sha256').update(pkg);
    for (const rel of listFiles(join(pkgDir, 'dist')).sort()) {
      hash.update(`\0${rel}\0`).update(readFileSync(join(pkgDir, 'dist', rel)));
    }
    const { version } = JSON.parse(pkg.toString()) as { version?: string };
    return { name: `host-kit@${version}+${hash.digest('hex').slice(0, 10)}`, apply: 'serve' };
  } catch (err) {
    console.warn(
      `[host-kit] cannot fingerprint ${pkgDir} (${(err as Error).message}); ` +
        'Vite may serve a stale host-kit, so delete node_modules/.vite after updating it',
    );
    return { name: 'host-kit', apply: 'serve' };
  }
}

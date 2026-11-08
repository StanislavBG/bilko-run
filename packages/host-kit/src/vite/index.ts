import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintPlugin, type HostKitVitePlugin } from './fingerprint';

export type { HostKitVitePlugin };

/**
 * Re-bundle host-kit in the Vite dev server whenever the installed copy changes.
 *
 * Vite pre-bundles host-kit into node_modules/.vite/deps and rebuilds that copy
 * only when the lockfile or the Vite config changes. A `file:` dependency's
 * version is not in pnpm-lock.yaml, so after `pnpm install` the dev server (and
 * a Playwright `webServer` running it) kept serving the old host-kit. This
 * plugin fingerprints the host-kit it ships in (dist/vite/ → package root).
 */
export function hostKitVite(): HostKitVitePlugin {
  return fingerprintPlugin(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
}

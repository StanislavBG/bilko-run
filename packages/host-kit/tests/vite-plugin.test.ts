// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type PluginOption } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hostKitVite } from '../src/vite';
import { fingerprintPlugin } from '../src/vite/fingerprint';

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

let app: string;
const kitDir = () => join(app, 'node_modules', 'kit');

/** (Re)install the kit the way pnpm installs a file: dependency: a copied directory, lockfile untouched. */
function installKit(build: string) {
  mkdirSync(join(kitDir(), 'dist'), { recursive: true });
  writeFileSync(
    join(kitDir(), 'package.json'),
    JSON.stringify({ name: 'kit', version: '1.0.0', type: 'module', exports: './dist/index.js' }),
  );
  writeFileSync(join(kitDir(), 'dist', 'index.js'), `export const build = '${build}';\n`);
}

/** Start the dev server, fetch the pre-bundled kit it serves, stop it. */
async function servedKit(plugins: PluginOption[]): Promise<string> {
  const server = await createServer({
    root: app,
    configFile: false,
    logLevel: 'silent',
    plugins,
    optimizeDeps: { include: ['kit'], noDiscovery: true },
    server: { host: '127.0.0.1', port: 0, ws: false },
  });
  await server.listen();
  try {
    const res = await fetch(new URL('node_modules/.vite/deps/kit.js', server.resolvedUrls!.local[0]));
    expect(res.status).toBe(200);
    return await res.text();
  } finally {
    await server.close();
  }
}

beforeEach(() => {
  app = mkdtempSync(join(tmpdir(), 'host-kit-vite-'));
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app', private: true, type: 'module' }));
  mkdirSync(join(app, 'node_modules', '.pnpm'), { recursive: true });
  writeFileSync(join(app, 'node_modules', '.pnpm', 'lock.yaml'), "lockfileVersion: '9.0'\n");
  installKit('kit-build-one');
});

afterEach(() => rmSync(app, { recursive: true, force: true }));

describe('host-kit/vite', () => {
  it('without the plugin, the dev server keeps a reinstalled file: dependency stale', async () => {
    expect(await servedKit([])).toContain('kit-build-one');
    installKit('kit-build-two');
    expect(await servedKit([])).toContain('kit-build-one');
  });

  it('with the plugin, the dev server re-bundles a reinstalled file: dependency', async () => {
    expect(await servedKit([fingerprintPlugin(kitDir())])).toContain('kit-build-one');
    installKit('kit-build-two');
    const served = await servedKit([fingerprintPlugin(kitDir())]);
    expect(served).toContain('kit-build-two');
    expect(served).not.toContain('kit-build-one');
  });

  it('with the plugin and no reinstall, the dev server reuses the pre-bundle', async () => {
    await servedKit([fingerprintPlugin(kitDir())]);
    const metadata = join(app, 'node_modules', '.vite', 'deps', '_metadata.json');
    const before = readFileSync(metadata, 'utf8');
    await servedKit([fingerprintPlugin(kitDir())]);
    expect(readFileSync(metadata, 'utf8')).toBe(before);
  });

  it('names the plugin after the version and a fingerprint of package.json and dist/', () => {
    const first = fingerprintPlugin(kitDir());
    expect(first).toEqual({ name: expect.stringMatching(/^host-kit@1\.0\.0\+[0-9a-f]{10}$/), apply: 'serve' });
    expect(fingerprintPlugin(kitDir()).name).toBe(first.name);
    installKit('kit-build-two');
    expect(fingerprintPlugin(kitDir()).name).not.toBe(first.name);
  });

  it('hostKitVite() fingerprints the host-kit package it ships in', () => {
    expect(hostKitVite()).toEqual(fingerprintPlugin(PKG_DIR));
  });
});

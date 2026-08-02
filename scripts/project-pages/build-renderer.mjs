#!/usr/bin/env node
// Precompiles scripts/project-pages/lib/render.tsx (the Stage 0 Project
// Pages renderer) into a single CJS bundle at
// scripts/project-pages/dist/renderer/renderer.cjs. Font bytes are inlined
// at bundle time — render.tsx imports them from library/fontData.ts (a
// generated module of base64 strings), not read from disk at render time,
// so there is no separate asset-copy step here.
//
// Run via `npm run build:project-pages`. scripts/project-pages/render.cjs
// (the CLI) requires this bundle and prints a clear error if it's missing —
// re-run this script whenever render.tsx or the library changes.
//
// Ported from
// ~/Projects/session-manager/scripts/build-project-pages-renderer.mjs
// (PRD 745) — entry/output paths adapted to this repo's scripts/project-pages/
// layout (source ported by PRD 744), otherwise identical esbuild config.
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(SCRIPT_DIR, 'lib/render.tsx');
const OUT_DIR = join(SCRIPT_DIR, 'dist/renderer');
const OUT_FILE = join(OUT_DIR, 'renderer.cjs');

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  await build({
    entryPoints: [ENTRY],
    outfile: OUT_FILE,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    jsx: 'automatic',
    external: ['react', 'react-dom'],
  });

  console.log(`Built ${OUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

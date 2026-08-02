#!/usr/bin/env node
// Precompiles scripts/project-pages/lib/logicBundle.ts (the non-React
// Project Pages logic — summary validation, selection scoring) into a single
// CJS bundle at scripts/project-pages/dist/logic/logic.cjs. Separate from
// build-renderer.mjs's bundle because that one externals react/react-dom for
// renderToStaticMarkup; this bundle has no such dependency, so its CLI
// consumers (validate-summary.cjs, select-picks.cjs) don't need react on
// their require path.
//
// Run via `npm run build:project-pages-logic`. Re-run whenever logicBundle.ts
// or anything it re-exports changes.
//
// Ported from ~/Projects/session-manager/scripts/build-project-pages-logic.mjs
// (PRD 745) — entry/output paths adapted to this repo's scripts/project-pages/
// layout (source ported by PRD 744), otherwise identical esbuild config.
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(SCRIPT_DIR, 'lib/logicBundle.ts');
const OUT_DIR = join(SCRIPT_DIR, 'dist/logic');
const OUT_FILE = join(OUT_DIR, 'logic.cjs');

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
    // logicBundle.ts re-exports select.ts, which pulls in library/index.ts
    // (the ported component library) — those slot modules are .tsx files
    // with JSX component definitions (never invoked here, only referenced
    // by id), so the bundle still needs the JSX transform + react as an
    // external, exactly like build-renderer.mjs's config.
    jsx: 'automatic',
    external: ['react', 'react-dom'],
  });

  console.log(`Built ${OUT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

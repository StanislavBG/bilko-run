#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    slug: { type: 'string' },
    out: { type: 'string', default: 'dist/manifest.json' },
  },
});

if (!values.slug) {
  console.error('--slug required');
  process.exit(2);
}

const run = (cmd) => {
  try { return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); }
  catch { return 'unknown'; }
};

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const files = walk('dist').filter(f => f !== values.out);
const totalGz = files.reduce((acc, f) => acc + gzipSync(readFileSync(f)).length, 0);
const sha = run('git rev-parse --short HEAD');
const branch = run('git rev-parse --abbrev-ref HEAD');
let kit = (pkg.dependencies?.['@bilkobibitkov/host-kit'] ?? '0.0.0').replace(/^[\^~]/, '');
if (!kit.match(/^\d/)) {
  try { kit = JSON.parse(readFileSync('node_modules/@bilkobibitkov/host-kit/package.json', 'utf8')).version ?? '0.0.0'; }
  catch { kit = '0.0.0'; }
}

writeFileSync(
  values.out,
  JSON.stringify(
    {
      schemaVersion: 1,
      slug: values.slug,
      version: pkg.version,
      builtAt: new Date().toISOString(),
      gitSha: sha,
      gitBranch: branch,
      hostKit: { version: kit },
      golden: { path: `/projects/${values.slug}/`, expect: pkg.name },
      health: {},
      bundle: { sizeBytesGz: totalGz, fileCount: files.length },
    },
    null,
    2,
  ),
);

console.log(
  `emit-manifest: ${values.slug} ${pkg.version} (${sha}, ${(totalGz / 1024).toFixed(1)} KB gz)`,
);

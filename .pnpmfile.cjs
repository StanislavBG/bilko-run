'use strict';
// Refuse any pnpm install when this checkout's node_modules is a symlink.
//
// Session Manager job/epic worktrees used to symlink node_modules to the main
// checkout. pnpm then installs THROUGH the link: it purges the shared modules
// dir and rewrites every top-level link relative to the worktree, so the main
// checkout's node_modules points into the worktree. Once the worktree is
// deleted, all of them dangle (2026-10-18: 37 links, publish a11y gate failed
// with "Playwright not installed"). preResolution runs only for install-type
// commands (install/add/update/remove, --filter, --lockfile-only) and before
// pnpm touches node_modules; `pnpm run`/`exec`/`test` never call it.
const fs = require('node:fs');
const path = require('node:path');

function assertOwnNodeModules(dir) {
  const modules = path.join(dir, 'node_modules');
  let st;
  try { st = fs.lstatSync(modules); } catch { return; }
  if (!st.isSymbolicLink()) return;
  let target;
  try { target = fs.realpathSync(modules); } catch { target = fs.readlinkSync(modules); }
  throw new Error(
    `${modules} is a symlink to ${target}. Installing through it would repoint that `
    + 'checkout\'s node_modules links at this tree. Remove the link (`rm node_modules`, '
    + 'no trailing slash) and install again to get a node_modules of your own.',
  );
}

module.exports = {
  assertOwnNodeModules,
  hooks: { preResolution: () => assertOwnNodeModules(__dirname) },
};

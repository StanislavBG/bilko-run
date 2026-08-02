#!/usr/bin/env node
// Thin CLI wrapper around validateProjectPageSummary (scripts/project-pages/
// lib/summaryValidate.ts), compiled into scripts/project-pages/dist/logic/
// logic.cjs by `npm run build:project-pages-logic`. Run this against a
// project's own summary.json before proceeding to selection/rendering.
//
// Usage: node scripts/project-pages/validate-summary.cjs <summary.json path>
// Exits 0 and prints "valid" on success; exits 1 and prints each error on
// failure. Same CLI-wrapper pattern as scripts/project-pages/render.cjs.
//
// The path argument is used as-is (no allowedRoots validation) — this is a
// standalone local dev/ops script run by a trusted human or agent shell, not
// an IPC-reachable surface, so it's out of scope for that guard by design.
//
// Ported from
// ~/Projects/session-manager/scripts/validate-project-pages-summary.cjs
// (PRD 745) — bundle path adapted to this repo's dist/logic/logic.cjs
// location (source ported by PRD 744).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  console.error(`validate-summary: ${message}`);
  process.exit(1);
}

function main() {
  const [summaryPath] = process.argv.slice(2);
  if (!summaryPath) {
    fail('usage: node scripts/project-pages/validate-summary.cjs <summary.json path>');
  }

  const bundlePath = path.join(__dirname, 'dist', 'logic', 'logic.cjs');
  if (!fs.existsSync(bundlePath)) {
    fail(`build bundle not found at ${bundlePath} — run "npm run build:project-pages-logic" first`);
  }

  let validateProjectPageSummary;
  try {
    ({ validateProjectPageSummary } = require(bundlePath));
  } catch (err) {
    fail(`failed to load ${bundlePath}: ${err.message}`);
  }

  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch (err) {
    fail(`could not read/parse ${summaryPath}: ${err.message}`);
  }

  const result = validateProjectPageSummary(summary);
  if (!result.ok) {
    console.error('validate-summary: invalid summary:');
    for (const err of result.errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log('valid');
}

main();

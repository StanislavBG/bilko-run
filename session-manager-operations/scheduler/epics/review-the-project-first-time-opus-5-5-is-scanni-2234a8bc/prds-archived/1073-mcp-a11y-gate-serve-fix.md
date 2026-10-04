---
title: Publish a11y gate: serve the real app (prefix-stripped assets, full MIME map, local axe)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:57:55.752Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl8o4o-637e79
---
# Goal

behavior: the a11y publish gate (mcp-host-server/src/gates/a11y.ts) serves the bundle from a local HTTP server but only strips `/projects/<slug>` from the golden path, not from asset requests. Real bundles reference `/projects/<slug>/assets/*.js`, which miss and fall back to index.html, so axe scans an empty shell. It also lacks MIME types for .mjs, .wasm and fonts, and loads axe from a CDN. This is why publishing agents routinely bypass the a11y gate (16 of 32 logged bypasses).

# Acceptance criteria

- [ ] gates/a11y.ts exports `startBundleServer(bundleDir: string, slug: string): Promise<{ port: number; close(): Promise<void> }>`, used by a11yGate
- [ ] The server strips a leading `/projects/<slug>` from every request path, refuses paths that resolve outside bundleDir (404), and falls back to index.html only for extension-less paths (SPA routes), returning 404 for missing assets
- [ ] The MIME map covers .html .js .mjs .css .json .svg .png .jpg .jpeg .gif .webp .ico .wasm .woff .woff2 .txt .map
- [ ] axe is injected from the local axe-core package (resolved with createRequire, `page.addScriptTag({ path })`), not a CDN URL, and page.goto has a 30 s timeout
- [ ] New test tests/mcp-a11y-server.test.ts starts startBundleServer on a tmp bundle and asserts: `/projects/<slug>/assets/app.js` returns the JS file with a JavaScript content type; `/projects/<slug>/some/route` returns index.html; a missing `/projects/<slug>/assets/missing.js` returns 404; `/projects/<slug>/../../etc/passwd` does not escape (404)

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/gates/a11y.ts
- tests/mcp-a11y-server.test.ts

# Implementation notes

Read first: mcp-host-server/src/gates/a11y.ts (93 lines); tests/publish-gate.test.ts a11y section (it mocks playwright; keep those tests green without editing that file); package.json (axe-core is a root devDependency).

Resolve axe with `createRequire(import.meta.url).resolve('axe-core/axe.min.js')`. Node resolution walks up from mcp-host-server/ to the root node_modules. If it does not resolve, return a fail result whose details give the install command, the same way the playwright-missing branch does. Normalize decoded paths with path.resolve and check they start with bundleDir + path.sep.

Do not touch: tests/publish-gate.test.ts, mcp-host-server/src/gates/budget.ts, mcp-host-server/src/server.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-a11y-server.test.ts tests/publish-gate.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

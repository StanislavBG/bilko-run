# Bilko npm publishing contract

Companion to [`host-contract.md`](./host-contract.md). That document covers the **static-path sibling app** contract (apps deployed to `bilko.run/projects/<slug>/`). This document covers the **npm package** contract (libraries + CLIs published to `npmjs.com` for public benefit).

The two contracts are independent: a sibling app may also publish parts of itself to npm; a published npm package need not be a sibling app.

## What is this

A short rulebook every Bilko npm package follows. Apply it to:

- Reusable libraries (`@bilkobibitkov/host-kit`, `@bilkobibitkov/sudoku-engine`).
- CLIs users `npx` (`@bilkobibitkov/agent-trace`, `@bilkobibitkov/page-roast`).
- Monorepo subpackages (anything under `Preflight/packages/*`).

## When code earns its own npm package

Pick the lowest applicable threshold:

1. **≥ 2 sibling apps import the same logic.** Extract before the third copy lands.
2. **It's a CLI users would install** (`npx @bilkobibitkov/<name>`).
3. **It's a peer SDK to a host service** (telemetry, game services, manifest emit).

If none apply, leave the code in its host repo. Don't extract for vanity.

## Three kinds of publishable package

| Kind | Example | Build shape | Notes |
|---|---|---|---|
| Library | `@bilkobibitkov/host-kit`, `sudoku-engine` | Dual ESM+CJS via `tsup`; `exports` map with `types`/`import`/`require` triple. | Browsers and Node both consume. |
| CLI | `@bilkobibitkov/agent-trace`, `@bilkobibitkov/page-roast` | ESM-only is fine; `bin` field; `#!/usr/bin/env node` shim in `bin/<name>.js`. | `npx @bilkobibitkov/<name> --help` must work. |
| Monorepo subpackage | `Preflight/packages/agent-comply`, `Preflight/packages/license` | Live in a `pnpm-workspace.yaml` workspace; tag format `<pkg>-v<ver>`. | Inter-package deps use the workspace's published version, not `workspace:*`, when shipped. |

## Required file tree

```
<repo-root>/
├── LICENSE                       ← MIT, the file. Not just metadata.
├── README.md                     ← uses docs/templates/README.npm.tmpl.md
├── CHANGELOG.md                  ← Changesets-managed or hand-kept; never with version gaps
├── package.json
├── tsconfig.json
├── tsup.config.ts                ← libraries; CLIs may use plain `tsc`
├── vitest.config.ts              ← or whatever test runner; tests are required
├── .github/workflows/release.yml ← from docs/templates/release.yml.tmpl
├── .changeset/                   ← if Changesets-managed
├── src/
│   └── index.ts
├── bin/                          ← if CLI
│   └── <name>.js
└── tests/
```

## Required `package.json` fields

```jsonc
{
  "name": "@bilkobibitkov/<name>",       // or unscoped if pre-existing on npm
  "version": "<semver>",                  // start at 0.1.0 for new packages
  "description": "<≤120 char one-liner>",
  "type": "module",

  "main": "./dist/index.cjs",             // libs only
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.js",
      "require": "./dist/index.cjs"        // omit for ESM-only / browser-only libs
    }
  },

  "bin": { "<friendly-name>": "./bin/<friendly-name>.js" },   // CLIs only

  "files": ["dist", "bin", "LICENSE", "README.md", "CHANGELOG.md"],

  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "pnpm run build && pnpm run test"
  },

  "engines": { "node": ">=18.0.0" },

  "publishConfig": {
    "access": "public",
    "provenance": true
  },

  "repository": {
    "type": "git",
    "url": "https://github.com/StanislavBG/<repo>.git",
    "directory": "packages/<name>"        // monorepo only
  },
  "homepage": "https://github.com/StanislavBG/<repo>#readme",
  "bugs": { "url": "https://github.com/StanislavBG/<repo>/issues" },

  "license": "MIT",
  "author": "Stanislav Bibitkov",

  "keywords": ["bilko", "<domain>", "..."]
}
```

`peerDependencies` for anything the consumer must provide (React, etc.). Never duplicate as `dependencies`.

## Required scripts

Every publishable package implements at minimum:

- `build` — produces `dist/`.
- `test` — exits non-zero on failure.
- `typecheck` — `tsc --noEmit`.
- `prepublishOnly` — runs build + test before any publish.

## Required metadata files

| File | Required | Notes |
|---|---|---|
| `LICENSE` | Yes (literal file at root) | MIT. Listing it in `files` without the file on disk ships a broken tarball. |
| `README.md` | Yes | Use the template at `docs/templates/README.npm.tmpl.md`. |
| `CHANGELOG.md` | Yes | One entry per published version. No skipped versions. |

## Required CI

`.github/workflows/release.yml` triggered on `v*.*.*` tag push (or `<pkg>-v*.*.*` for monorepo subpackages). Pinned actions by SHA. Steps: checkout → setup-node 20 with `registry-url: https://registry.npmjs.org` → setup-pnpm → install (frozen lockfile) → build → test → `npm publish --access public --provenance`.

Token: GH org secret `NPM_AUTOMATION_TOKEN`, scoped to `@bilkobibitkov/*`.

Provenance requires the source URL on GitHub: a published-but-private package cannot use `--provenance`. Every Bilko npm publish lives at `github.com/StanislavBG/<repo>` (public).

## Required versioning discipline

- **Single-package repo**: `pnpm version <semver>` + manual CHANGELOG entry. Tag `v<ver>`. Push tag → CI publishes.
- **Monorepo (Preflight, …)**: Changesets. `pnpm changeset` per change → `pnpm changeset version` bumps + writes CHANGELOG → `pnpm changeset publish` (CI does this).
- **Never skip a version.** A bumped CHANGELOG hole signals abandonment to consumers.

## Required BYOK pattern (AI tool CLIs)

User's API key lookup order:

1. `BILKO_<TOOL>_API_KEY` (most specific)
2. `<PROVIDER>_API_KEY` (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
3. `<PROVIDER_ALT>_API_KEY` (`GOOGLE_API_KEY`)
4. CLI flag `--<provider>-key=<key>`
5. Interactive prompt (last resort)

README has a "BYOK env vars" table listing every name the CLI checks, in order.

Never log raw keys. Bilko's host-kit telemetry already redacts `/(email|password|token|key|ssn|card|cvv|apikey)/i` — same rule for any new package's logs.

## Publish gate (5 stages)

Mirrors the static-path publish gate from `host-contract.md`. Each must pass before tag push:

1. **Build** — `pnpm build` clean.
2. **Test** — `pnpm test` clean.
3. **Typecheck** — `pnpm typecheck` clean.
4. **Changelog** — `CHANGELOG.md` has an entry for the new version.
5. **Size** — `pnpm pack --dry-run` shows tarball size below per-kind cap (libs ≤30 KB, CLIs ≤50 KB, host-kit ≤200 KB).

## Token setup runbook

One-time, by the maintainer:

1. Go to `https://www.npmjs.com/settings/bilkobibitkov/tokens`.
2. **Generate New Token** → **Automation**. Scope to `@bilkobibitkov/*` if you want package isolation; otherwise leave full publish.
3. Copy the token (shown once).
4. Add as a GH org secret:
   ```bash
   gh secret set NPM_AUTOMATION_TOKEN \
     --org StanislavBG \
     --visibility selected \
     --repos "bilko-host-kit,Preflight,sudoku-engine,minesweeper-engine,webgpu-gemma,ai-tool-kit,page-roast,headline-grader,ad-scorer,thread-grader,email-forge,audience-decoder,launch-grader,stack-audit,session-manager,bilko-flow"
   # Paste the token when prompted.
   ```
5. Verify: tag a no-op version, push tag, watch the workflow publish.

The token is **automation-class** — bypasses 2FA for CI but is tied to the maintainer's 2FA enrollment. If the token leaks: revoke at npm immediately, rotate, update the GH secret.

## Cross-references

- [`host-contract.md`](./host-contract.md) — sibling app contract (separate concern).
- [`templates/release.yml.tmpl`](./templates/release.yml.tmpl) — copy into each new package's `.github/workflows/release.yml`.
- [`templates/README.npm.tmpl.md`](./templates/README.npm.tmpl.md) — copy into each new package's `README.md` and substitute `{{...}}` placeholders.
- Reference packages: `~/Projects/Bilko-Host-Kit/package.json` (library), `~/Projects/Preflight/packages/agent-trace/package.json` (CLI).

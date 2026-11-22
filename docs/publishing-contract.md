# Bilko npm publishing contract

Companion to [`host-contract.md`](./host-contract.md). That document covers the **static-path sibling app** contract (apps deployed to `bilko.run/projects/<slug>/`). This document covers the **npm package** contract (libraries and CLIs published to `npmjs.com`).

The two contracts are independent: a sibling app may also publish parts of itself to npm; a published npm package need not be a sibling app. A package that is both (for example the PageRoast CLI and its `/projects/page-roast/` page) follows both contracts.

## What the host provides for npm packages

Nothing at runtime. npm packages are standalone: they don't inherit bilko.run auth, credits, Clerk, or Stripe. The shared parts are:

- **A by-hand release procedure.** See [Releasing](#releasing). No repo has an npm automation token, so no CI workflow can publish.
- **A README template**, [`templates/README.npm.tmpl.md`](./templates/README.npm.tmpl.md).
- **Versioning discipline**, described below.

## What this applies to

- Reusable libraries: `host-kit` (in this repo, `packages/host-kit/`).
- CLIs users `npx`: `@bilkobibitkov/page-roast`.
- Monorepo subpackages: anything under `Preflight/packages/*`, for example `@bilkobibitkov/preflight-license` (`Preflight/packages/license`).

## When code earns its own npm package

Pick the lowest applicable threshold:

1. **≥ 2 sibling apps import the same logic.** Extract before the third copy lands.
2. **It's a CLI users would install** (`npx @bilkobibitkov/<name>`).
3. **It's a peer SDK to a host service** (telemetry, game services, manifest emit).

If none apply, leave the code in its host repo.

## Three kinds of publishable package

| Kind | Example | Build shape | Notes |
|---|---|---|---|
| Library | `host-kit` | Dual ESM+CJS via `tsup`; `exports` map with `types`/`import`/`require` triple. | Browsers and Node both consume. |
| CLI | `@bilkobibitkov/page-roast` | ESM-only is fine; `bin` field; `#!/usr/bin/env node` shim in `bin/<name>.js`. | `npx @bilkobibitkov/<name> --help` must work. |
| Monorepo subpackage | `@bilkobibitkov/preflight-license` | Lives in a `pnpm-workspace.yaml` workspace. | Inter-package deps use the published version, not `workspace:*`, in the shipped tarball. |

## Required file tree

```
<package-root>/
├── LICENSE                       ← MIT, the file. Not just metadata.
├── README.md                     ← from docs/templates/README.npm.tmpl.md
├── CHANGELOG.md                  ← Changesets-written or hand-kept; never with version gaps
├── package.json
├── tsconfig.json
├── tsup.config.ts                ← libraries; CLIs may use plain `tsc`
├── vitest.config.ts              ← or another test runner; tests are required
├── src/
│   └── index.ts
├── bin/                          ← if CLI
│   └── <name>.js
└── tests/
```

Changesets config (`.changeset/`) lives at the repo root when the repo uses it. This repo does: host-kit's versions and CHANGELOG come from `.changeset/`.

## Required `package.json` fields

```jsonc
{
  "name": "@bilkobibitkov/<name>",       // or unscoped if pre-existing on npm (host-kit)
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
    "prepublishOnly": "pnpm run build"
  },

  "engines": { "node": ">=18.0.0" },

  "publishConfig": {
    "access": "public",
    "provenance": false                   // by-hand publishes cannot attest provenance
  },

  "repository": {
    "type": "git",
    "url": "https://github.com/StanislavBG/<repo>.git",
    "directory": "packages/<name>"        // monorepo only
  },
  "homepage": "https://github.com/StanislavBG/<repo>#readme",
  "bugs": { "url": "https://github.com/StanislavBG/<repo>/issues" },

  "license": "MIT",
  "author": "Bilko Bibitkov",

  "keywords": ["bilko", "<domain>", "..."]
}
```

`peerDependencies` for anything the consumer must provide (React, etc.). Never duplicate as `dependencies`.

`--provenance` only works from a supported CI runner, so `publishConfig.provenance` is `false` (as in `packages/host-kit/package.json`).

## Required scripts

- `build`: produces `dist/`.
- `test`: exits non-zero on failure.
- `typecheck`: `tsc --noEmit`.
- `prepublishOnly`: `pnpm run build`. It rebuilds `dist/` before a publish; tests run in the release gate, not here.

## Required metadata files

| File | Required | Notes |
|---|---|---|
| `LICENSE` | Yes (literal file in the package root) | MIT. Listing it in `files` without the file on disk ships a broken tarball. |
| `README.md` | Yes | From [`templates/README.npm.tmpl.md`](./templates/README.npm.tmpl.md). |
| `CHANGELOG.md` | Yes | One entry per published version. No skipped versions. |

## Versioning

- **Changesets repos (this repo for host-kit, Preflight):** add a changeset per change with `pnpm changeset`; at release time `pnpm changeset version` bumps `package.json` and writes the CHANGELOG entry.
- **Other single-package repos:** `pnpm version <semver>` plus a hand-written CHANGELOG entry.
- **Never skip a version.** A CHANGELOG hole signals abandonment to consumers.

## BYOK (AI tool CLIs)

An AI-tool CLI brings the user's own API key. The lookup order and the env-var table live only in the "BYOK env vars" section of [`templates/README.npm.tmpl.md`](./templates/README.npm.tmpl.md); copy it into the package README and list every name the CLI checks, in order.

Never log raw keys. host-kit telemetry redacts `/(email|password|token|key|ssn|card|cvv|apikey)/i`; any new package's logs follow the same rule.

## Releasing

Every Bilko npm package is published by hand from the maintainer's npm login. The full procedure, including picking the semver bump, is the builder skill (`session-manager-dev:builder`, run as `/builder`). In short:

1. **Isolated worktree.** `git worktree add` at the release commit (a fresh `origin/main`), never the live working directory. Install with the frozen lockfile.
2. **Build and test there.** `pnpm build`, `pnpm test`, `pnpm typecheck`. Bump the version (`pnpm changeset version` or `pnpm version`) and confirm the CHANGELOG has the entry.
3. **Pack.** `npm pack` in the package directory.
4. **Scan the tarball.** `tar -tzf <file>.tgz`: `LICENSE`, `README.md`, `CHANGELOG.md` and every `files` path present; no secrets, `.env` files, test fixtures or stray source maps.
5. **Publish that tarball.** `npm publish <file>.tgz --access public`, not the directory, so what was scanned is what ships.
6. **Verify on npm** with a cache-busted URL, for example `https://registry.npmjs.org/host-kit?nocache=<timestamp>`, and check that `dist-tags.latest` is the new version.
7. **Tag and push the tag.** host-kit's tag is `host-kit-v<ver>` (the pattern `.github/workflows/host-kit-release.yml` watches). That workflow needs an `NPM_AUTOMATION_TOKEN` secret this repo does not have, so its publish step fails; the by-hand publish above is the release.

### Release checklist

```
[ ] isolated worktree at the release commit, frozen-lockfile install
[ ] pnpm build / pnpm test / pnpm typecheck   — all exit 0
[ ] CHANGELOG.md has an entry for <ver>        — no version gaps
[ ] npm pack; tarball scanned                  — LICENSE present, only needed files
[ ] npm publish <file>.tgz --access public
[ ] cache-busted registry URL shows <ver> as dist-tags.latest
[ ] tag pushed                                  — host-kit-v<ver> for host-kit
```

## `files` field integrity

Every path listed in `"files"` must exist on disk at publish time. A missing file ships silently: npm doesn't error, consumers just don't get it. The common case is listing `"LICENSE"` without the file on disk. The tarball scan in step 4 catches it.

## Package size

There is no size cap. The tarball must list only files the package needs; if it has stray files, audit `files`, strip test fixtures, and confirm `dist/` has no unintended source maps.

## Monorepo subpackage extras

For packages under `Preflight/packages/*`:

- The **root** `package.json` is `private: true`; it never publishes.
- Each subpackage's `repository.directory` points to `packages/<name>`.
- Inter-package deps reference the **published version**, not `workspace:*`, in the shipped tarball. `changeset version` handles this.
- `pnpm -r build` and `pnpm -r test` build and test every subpackage before a release.

## Naming conventions

| Concern | Convention |
|---|---|
| Scoped package name | `@bilkobibitkov/<name>` (host-kit keeps its unscoped name) |
| Binary name | `<name>` (matches the `bin` key and the npm package short name) |
| Tag format (single-package repo) | `v<semver>` (e.g. `v1.2.3`) |
| Tag format (package inside a multi-package repo) | `<pkg>-v<semver>` (e.g. `host-kit-v0.11.0`) |
| Dist directory | `dist/`: never committed; built in the release worktree |
| Styles directory | `styles/`: committed as-is; raw CSS tokens ship as source |

## Cross-references

- [`host-contract.md`](./host-contract.md): sibling app contract (separate concern).
- [`templates/README.npm.tmpl.md`](./templates/README.npm.tmpl.md): copy into each new package's `README.md` and substitute the `{{...}}` placeholders.
- Reference package: `packages/host-kit/package.json` in this repo.

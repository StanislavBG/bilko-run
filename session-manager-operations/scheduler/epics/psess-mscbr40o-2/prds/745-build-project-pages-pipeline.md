---
title: Build Project Pages esbuild pipeline + CLI wrappers, wire npm scripts, verify end-to-end
cwd: ~/Projects/Bilko
estimateMinutes: 30
---

# Goal

PRD 744 ported the Project Pages logic/component-library source into
`scripts/project-pages/lib/` but left it unbuildable — no esbuild bundling, no CLI entry points.
Port the 2 esbuild build scripts and 3 thin CLI wrappers from `~/Projects/session-manager`,
adapt their paths to Bilko's layout, add `package.json` scripts, and prove the whole Stage
0/2/3 pipeline (validate → select → render) actually runs end-to-end against a small hand-written
fixture, producing real static HTML output. This is infrastructure only — it does not compute
Bilko's real project summary (that's separate, out-of-scope work handled directly by the
`project-home-builder` agent once this PRD lands, per
`session-manager-operations/architecture/project-pages-pipeline.md`'s Stage 1 description, which
the fixture in this PRD's AC exists to unblock).

# Acceptance criteria

## Build scripts

- [ ] `scripts/project-pages/build-logic.mjs` exists, ported from
      `~/Projects/session-manager/scripts/build-project-pages-logic.mjs`, adapted to bundle
      `scripts/project-pages/lib/logicBundle.ts` (this repo's ported copy, from PRD 744) into
      `scripts/project-pages/dist/logic/logic.cjs` — same esbuild config as the source
      (`bundle: true, platform: 'node', format: 'cjs', target: 'node18', jsx: 'automatic',
      external: ['react', 'react-dom']`).
- [ ] `scripts/project-pages/build-renderer.mjs` exists, ported from
      `~/Projects/session-manager/scripts/build-project-pages-renderer.mjs`, adapted to bundle
      `scripts/project-pages/lib/render.tsx` into `scripts/project-pages/dist/renderer/renderer.cjs`
      (same esbuild config as the source).
- [ ] `package.json` gains two scripts: `"build:project-pages-logic": "node
      scripts/project-pages/build-logic.mjs"` and `"build:project-pages": "node
      scripts/project-pages/build-renderer.mjs"`.
- [ ] Both `npm run build:project-pages-logic` and `npm run build:project-pages` succeed and
      produce their respective `.cjs` bundles.

## CLI wrappers

- [ ] `scripts/project-pages/validate-summary.cjs` exists, ported from
      `~/Projects/session-manager/scripts/validate-project-pages-summary.cjs`, requiring
      `scripts/project-pages/dist/logic/logic.cjs` (path adjusted to this repo's build-logic
      output location) and exporting the same `validateProjectPageSummary(summaryPath)` CLI
      contract: exits 0 and prints `valid` on success, exits 1 and lists each error otherwise.
- [ ] `scripts/project-pages/select-picks.cjs` exists, ported from
      `~/Projects/session-manager/scripts/select-project-pages-picks.cjs`, same CLI contract:
      `node scripts/project-pages/select-picks.cjs <summary.json> <existing picks.json | none>
      <output picks.json> [resetSlots]`.
- [ ] `scripts/project-pages/render.cjs` exists, ported from
      `~/Projects/session-manager/scripts/render-project-pages.cjs`, requiring
      `scripts/project-pages/dist/renderer/renderer.cjs` (path adjusted), same CLI contract:
      `node scripts/project-pages/render.cjs <summary.json> <picks.json> <output dir>
      <generatedAt ISO timestamp>` — writes `home.html`, `marketing.html`, `feature.html`,
      `architecture.html`, and `manifest.json` (`{ generatedAt }`) to `<output dir>`.

## End-to-end verification

- [ ] Write a minimal but schema-valid fixture `ProjectPageSummary` JSON (every field from
      `scripts/project-pages/lib/summaryType.ts`'s `ProjectPageSummary` interface populated with
      short real-ish placeholder strings — e.g. `identity.name: "Bilko"` is fine as a fixture
      value; this fixture is throwaway test data, not the real summary, so it is exempt from the
      "never fabricate" rule that applies to the actual generated summary.json) at
      `/tmp/project-pages-fixture-summary.json` (scratch location, not committed).
- [ ] Run, in order, and confirm each succeeds: (1) `node scripts/project-pages/validate-summary.cjs
      /tmp/project-pages-fixture-summary.json` prints `valid`; (2) `node
      scripts/project-pages/select-picks.cjs /tmp/project-pages-fixture-summary.json none
      /tmp/project-pages-fixture-picks.json` writes a non-empty `picks.json` covering all 4
      lenses (`home`/`marketing`/`feature`/`architecture`); (3) `node
      scripts/project-pages/render.cjs /tmp/project-pages-fixture-summary.json
      /tmp/project-pages-fixture-picks.json /tmp/project-pages-fixture-output
      2026-08-02T00:00:00.000Z` writes `home.html`, `marketing.html`, `feature.html`,
      `architecture.html`, `manifest.json` to `/tmp/project-pages-fixture-output/`, and each HTML
      file is non-empty, contains no `<script>` tags referencing a network URL, and contains an
      inline `<style>` block (confirms self-contained static HTML, no runtime JSX transform, no
      network egress — the pipeline's hard rule).
- [ ] Delete the `/tmp/project-pages-fixture-*` scratch files after verifying (they're throwaway,
      not part of the repo).

## Docs

- [ ] Write `session-manager-operations/project-pages/README.md` documenting: the pipeline stages
      (validate → select → render), the 3 CLI commands and their arguments (from this PRD's AC
      above), and the 3 on-disk paths a human/agent would touch — `project-pages/summary.json`
      (computed inputs, not created by this PRD), `project-pages/picks.json` (per-slot overrides,
      not created by this PRD), and `scripts/project-pages/lib/library/` (the component library
      itself, shared across regenerations — editing it is a code change, not a per-generation
      override). Mirror the tone/structure of the ported `design-mocks/` README from PRD 744, not
      an `OWNERS`-namespace README — `project-pages/` is agent-authored artifact output, not a
      main-process-orchestrated namespace (same class as `design-mocks/`).

## Tests

- [ ] `timeout 120 npx tsc --noEmit -p scripts/project-pages/tsconfig.json` (the scoped tsconfig
      PRD 744 created) still passes after this PRD's changes.

# Implementation notes

- Depends on PRD 744 (`744-port-project-pages-library.md`) — read what it actually landed
  (`scripts/project-pages/lib/` tree, `scripts/project-pages/tsconfig.json`) before starting;
  its plan may have shifted slightly during execution, so verify the real paths on disk rather
  than assuming this PRD's description of them is exact.
- Source repo for all ported scripts: `~/Projects/session-manager` (sibling repo, read directly
  from its filesystem path — `scripts/build-project-pages-logic.mjs`,
  `scripts/build-project-pages-renderer.mjs`, `scripts/validate-project-pages-summary.cjs`,
  `scripts/select-project-pages-picks.cjs`, `scripts/render-project-pages.cjs`).
- The two build scripts differ only in entry point / output path / externals note (see each
  source file's own comments) — both externalize `react`/`react-dom` and use `jsx: 'automatic'`.
- `logicBundle.ts` (ported in PRD 744) re-exports `select.ts`'s `scoreVariants`/`mergePicks` and
  `summaryValidate.ts`'s `validateProjectPageSummary`, plus `LENS_LIBRARY`/`LENS_ORDER` from
  `library/index.ts` — the CLI wrappers destructure these names off the required bundle. Confirm
  the exact export names by reading the ported `logicBundle.ts` rather than assuming this PRD's
  description is exhaustive.
- Do not add `allowedRoots`/path-validation guards to these CLI scripts — per the source scripts'
  own comments, they're trusted local dev/ops tools run by a human or agent shell, not an
  IPC-reachable surface, so that guard class is deliberately out of scope (matches session-manager's
  own design decision — don't relitigate it here).

## Engineering standards

Before writing any code, read
`/home/bilko/Projects/session-manager/plugins/session-manager-dev/skills/develop/standards.md`
— it has the Performance, Debugging, API-reuse, TDD, and Execution-discipline rules that apply to
this PRD. Every rule in it is mandatory, especially Execution discipline (bounded commands, verify
before done, the finish-protocol sentinel).

# Out of scope

- Computing Bilko's real `ProjectPageSummary` (`session-manager-operations/project-pages/summary.json`)
  — that's live agent work per the pipeline spec's Stage 1, not a scheduled PRD. Don't create a
  real (non-fixture) `summary.json` in this PRD.
- Any UI/button/trigger surface ("Generate Now") — Bilko has no Epic-tag UI like session-manager's;
  this PRD only needs the CLI pipeline to work when invoked directly.
- Regenerating font data, adding new slots/variants, or editing the ported component library.
- Committing the fixture files used for verification — they're scratch/throwaway.

# Project Pages — generated artifact (agent-authored, not an OWNERS namespace)

This documents the on-disk shape of `project-pages/` once something has run
the pipeline — it is currently empty in this repo; PRD 745 ports the
pipeline's CLI scripts and proves them end-to-end against a throwaway
fixture, it does **not** compute a real summary for Bilko. Same class of
folder as [`design-mocks/`](../design-mocks/project-pages-component-library/README.md)
— agent-authored output, one author per invocation, not a main-process
`OWNERS` namespace with write arbitration.

## The pipeline: validate → select → render

Three CLI stages, each a thin wrapper around logic precompiled by esbuild
into `scripts/project-pages/dist/`:

1. **Validate** — checks a `summary.json` is well-formed before anything
   downstream trusts it.
2. **Select** — scores every slot/variant in the component library against
   the summary and merges the result into a `picks.json` (one slot→variant
   choice per lens: home / marketing / feature / architecture).
3. **Render** — turns `summary.json` + `picks.json` into fully
   self-contained static HTML (inline CSS, base64-embedded fonts, zero
   `<script>` tags, zero network egress) — one file per lens plus a
   `manifest.json`.

Build the two esbuild bundles once (and re-run whenever
`scripts/project-pages/lib/` changes):

```
npm run build:project-pages-logic   # → scripts/project-pages/dist/logic/logic.cjs
npm run build:project-pages         # → scripts/project-pages/dist/renderer/renderer.cjs
```

## The 3 CLI commands

```
node scripts/project-pages/validate-summary.cjs <summary.json>
```
Exits 0 and prints `valid` on success; exits 1 and lists each error otherwise.

```
node scripts/project-pages/select-picks.cjs <summary.json> <existing picks.json | none> <output picks.json> [resetSlots]
```
Scores every lens's slots against the summary and writes a merged
`picks.json`. Pass `none` for the second argument on a first run. `resetSlots`
is an optional comma-separated list of slot ids (bare, or `<lensId>.<slotId>`)
to re-score instead of keeping the existing pick.

```
node scripts/project-pages/render.cjs <summary.json> <picks.json> <output dir> <generatedAt>
```
Writes `home.html`, `marketing.html`, `feature.html`, `architecture.html`,
and `manifest.json` (`{ generatedAt }`) to `<output dir>`. `generatedAt` is a
required ISO 8601 timestamp the caller stamps — this script never generates
its own.

None of the three scripts validate their path arguments against an
allowed-roots list — they're trusted local dev/ops tools run by a human or
agent shell, not an IPC-reachable surface, so that guard is out of scope by
design (same reasoning as the source scripts they were ported from).

## The 3 on-disk paths

- **`project-pages/summary.json`** — the computed `ProjectPageSummary` for a
  given project (`scripts/project-pages/lib/summaryType.ts`). Not created by
  this PRD — whichever process eventually composes a real Bilko summary
  writes it here, by hand, with its own Read/Write tools.
- **`project-pages/picks.json`** — the per-slot overrides `select-picks.cjs`
  produces. Not created by this PRD either; re-run `select-picks.cjs` with
  the existing file as the second argument to preserve prior picks while
  re-scoring only `resetSlots`.
- **`scripts/project-pages/lib/library/`** — the component library itself
  (slot definitions, variants, presets, design tokens, font data). Shared
  across every regeneration for every project — editing it is a code change
  to the pipeline, not a per-generation override, and is out of scope for
  whatever writes `summary.json`/`picks.json`.

## Why this is NOT an `OWNERS` namespace

There is no backend synthesis job and no `config.cjs` write path for any of
these three files — each is written directly by a Claude session's own
`Read`/`Write` tool calls. Bilko's write-arbitration story has no way to
intercept that, so declaring `project-pages/` an `OWNERS` namespace would be
a claim the code can't back up. Two concurrent generations for the same
project racing each other's `summary.json`/`picks.json` is a UX bug to
prevent at the generation-trigger layer, not a race this folder's layout
defends against.

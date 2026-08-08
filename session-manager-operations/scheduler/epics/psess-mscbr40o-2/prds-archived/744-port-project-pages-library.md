---
title: Port Project Pages component library + logic source into Bilko (vendored copy)
cwd: ~/Projects/Bilko
estimateMinutes: 25
---

# Goal

Bilko is missing the entire "Project Pages" static-site-generation pipeline that session-manager
already built and uses to generate its own Home/Marketing/Feature/Architecture pages. Port the
design-mock component library and the non-Electron-specific TS/TSX logic modules from
`~/Projects/session-manager` into this repo as a vendored, self-contained copy (Bilko is a
Vite+Fastify app, not Electron — strip any Electron/IPC-specific imports found along the way).
This PRD only ports source files and verifies they typecheck in isolation; it does NOT wire up
the esbuild build scripts or CLI wrappers (that's PRD 745, which depends on this one).

# Acceptance criteria

- [ ] `session-manager-operations/design-mocks/project-pages-component-library/` exists in this
      repo, copied verbatim (including `README.md`, `Component-Library.bundle.html`, and all of
      `source/*.jsx`) from
      `~/Projects/session-manager/session-manager-operations/design-mocks/project-pages-component-library/`.
      Treat as read-only reference — do not edit its contents.
- [ ] `scripts/project-pages/lib/` exists in this repo containing ported copies of these files
      from `~/Projects/session-manager/src/renderer/lib/projectPages/` (same relative structure):
      `summaryType.ts`, `selectionPredicates.ts`, `select.ts`, `summaryValidate.ts`,
      `logicBundle.ts`, `render.tsx`, `library/types.ts`, `library/kit.tsx`, `library/fontData.ts`,
      `library/index.ts`, `library/marketingSlots.tsx`, `library/featureSlots.tsx`,
      `library/architectureSlots.tsx`, `library/homeSlots.tsx`, and the 5 font binaries under
      `fonts/*.woff2` (`geist-400-700.woff2`, `ibm-plex-mono-400.woff2`, `ibm-plex-mono-500.woff2`,
      `ibm-plex-mono-600.woff2`, `newsreader-400-700.woff2`).
- [ ] The 3 test files under `session-manager`'s `src/renderer/lib/projectPages/__tests__/`
      (`summaryValidate.test.ts`, `render.test.tsx`, `select.test.ts`) are ported into
      `scripts/project-pages/lib/__tests__/` with import paths adjusted to the new location.
- [ ] Every ported file's imports resolve to other files inside `scripts/project-pages/lib/` only
      (or to `react`/`react-dom`, already a Bilko dependency) — no import reaches back into
      session-manager's own `src/main/`, `src/renderer/` (outside this ported tree), or any
      Electron/IPC module. If a source file imports something Electron-specific, adapt or drop
      that import and note the change in the file (only if actually encountered — the modules
      listed above are pure logic/JSX with no Electron dependency as of this writing, so this
      should be a non-issue, but verify by reading each file rather than assuming).
- [ ] `npx tsc --noEmit -p tsconfig.json` (or a scoped `npx tsc --noEmit scripts/project-pages/lib/**/*.ts scripts/project-pages/lib/**/*.tsx --jsx react-jsx --esModuleInterop --skipLibCheck --moduleResolution bundler` if the main tsconfig doesn't include `scripts/`) passes with no errors on the ported tree. Check `tsconfig.json`'s existing `include`/`exclude` first — if `scripts/` is already excluded repo-wide (likely, since Bilko's `scripts/` dir is tooling, not app code), don't change the main tsconfig's app-facing behavior; instead add a small dedicated `scripts/project-pages/tsconfig.json` that extends the root config and typechecks just this tree, and run `npx tsc --noEmit -p scripts/project-pages/tsconfig.json`.

# Implementation notes

- Source repo root for everything ported here: `~/Projects/session-manager` (a sibling repo on
  this machine, already cloned — read directly from its filesystem path, do not fetch it).
- The design-mock library's own `README.md` (ported in this PRD) explains the file load order
  (`00-kit-and-project-summary-shape.jsx` → `10`/`11` marketing → `20`/`21` feature → `30`
  architecture → `40-shell.jsx`) — read it, but note the `.jsx` files under `design-mocks/` are
  reference/extraction only, not what gets imported by the ported `.tsx` logic. The real,
  already-ported-to-TSX component library lives at `library/*.tsx` (ported by this PRD) — that's
  what `render.tsx` and `select.ts` actually import.
- `library/fontData.ts` is already a generated module of base64-encoded font strings (generated
  by session-manager's `scripts/generate-project-pages-font-data.mjs` from the `.woff2` files) —
  copy it as-is, do not regenerate; the `.woff2` files are ported alongside it for provenance but
  aren't read at runtime (the base64 is baked into `fontData.ts`).
- `summaryType.ts` defines `ProjectPageSummary`/`ProjectPagePicks` — this is the schema PRD 746
  (a later, not-yet-authored piece of work outside this PRD chain) will use to compute Bilko's
  real project summary. Don't modify the schema in this PRD.
- Bilko already has `esbuild ^0.25`, `react ^18.3`, `react-dom ^18.3`, `typescript ^5.6` as
  dependencies (checked in `package.json`) — no new npm installs needed for this PRD.
- This PRD does not need network access or Bilko's own app/server to be running — it's a pure
  file-port + typecheck task.

## Engineering standards

Before writing any code, read
`/home/bilko/Projects/session-manager/plugins/session-manager-dev/skills/develop/standards.md`
— it has the Performance, Debugging, API-reuse, TDD, and Execution-discipline rules that apply to
this PRD. Every rule in it is mandatory, especially Execution discipline (bounded commands, verify
before done, the finish-protocol sentinel).

# Out of scope

- Building the esbuild bundles, CLI wrapper scripts, or wiring `package.json` scripts (PRD 745).
- Computing Bilko's actual `ProjectPageSummary` content (that's live agent work per
  `session-manager-operations/architecture/project-pages-pipeline.md`'s Stage 1, done directly by
  the `project-home-builder` agent session once this infra exists — not a scheduled PRD).
- Editing any file under the ported `design-mocks/project-pages-component-library/source/` —
  read-only reference.
- Regenerating font data or adding new fonts/slots/variants.

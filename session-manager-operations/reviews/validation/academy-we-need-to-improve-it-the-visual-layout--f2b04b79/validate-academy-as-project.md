# Validation: academy-we-need-to-improve-it-the-visual-layout--f2b04b79

Base: `45a960b1ba2b6ef963ca12db4e6fca0fe4e7b6c5`

PRD files were found in the **main tree** (`/home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/academy-we-need-to-improve-it-the-visual-layout--f2b04b79/prds-archived/`), not in this worktree — each PRD ran with `cwd: /home/bilko/Projects/Bilko` per `queue.json`/`history.jsonl`. This worktree shares the same git history, so all commits are visible and verifiable here.

Commit mapping (one commit per PRD, confirmed via `git log --oneline <base>..HEAD -- <PRD's Files paths>`):

| PRD slug | Commit |
|---|---|
| academy-retire-inrepo-pages (1055) | `dfa1a99` fix(academy): retire orphaned in-repo Academy pages, redirect to sibling |
| academy-drop-nav-section (1056) | `bc99333` fix(nav): drop Academy from top-level SECTIONS |
| projects-commit-counts-sidecar (1057) | `d2c9fc0` feat(projects): bake commit-counts.json sidecar for hub sort |
| projects-sort-by-commit-count (1058) | `734908f` feat(projects): sort hub by commit count, add Academy to public set |

## academy-retire-inrepo-pages (1055) — VERIFIED

- `src/pages/AcademyPage.tsx`, `src/pages/AcademyLevelPage.tsx`, `src/data/academy/`, `src/components/academy/` — all absent (`ls`/`-e` check: "deleted" for all four).
- `grep -rn "AcademyPage\|AcademyLevelPage\|academy/lessons\|components/academy" src/` → no hits outside the deleted set.
- `src/App.tsx:92-96` defines `RedirectAcademyToCourse` (`useEffect` → `window.location.replace('/projects/academy/')`, returns null); `src/App.tsx:187-188` mounts it on `path="/academy"` and `path="/academy/*"`.
- `tests/academy-retired.test.ts` exists and passes (gate, see below).
- Gate: `pnpm vitest run tests/academy-retired.test.ts` → 2/2 passed. `pnpm typecheck` → exit 0 (no output). `pnpm build` → vite build succeeded, `tsc -p tsconfig.server.json` succeeded (part of full build run below).

## academy-drop-nav-section (1056) — VERIFIED

- `src/data/portfolio.ts:77-81` — `SECTIONS` ids in order: `home, projects, blog, workflows, contact`. No `academy` entry.
- `grep -rn "ACADEMY_LEVELS\|AcademyLevel" src/` → no hits (interface and constant both removed).
- `src/components/Layout.tsx:15-21` `activeSectionPath` has no `/academy` branch.
- `src/components/Layout.tsx:164,170` footer slices changed to `SECTIONS.slice(0, 3)` ("Sections": Home/Projects/Blog) and `SECTIONS.slice(3)` ("More": Workflows/Contact) — all 5 remaining sections render, none dropped.
- `tests/academy-nav.test.ts` exists and passes (gate, see below).
- Gate: `pnpm vitest run tests/academy-nav.test.ts` → 2/2 passed. `pnpm typecheck` → exit 0.

## projects-commit-counts-sidecar (1057) — VERIFIED

- `scripts/refresh-commit-order.ts:64-74` adds `commitCount(src)` mirroring `lastCommitISO` (same `.git` existence guard, `execFileSync('git', ['-C', repo, 'rev-list', '--count', 'HEAD', ...])`, parses with `parseInt`, returns `null` on error/0/non-positive).
- `src/data/commit-counts.json` exists, contains `"academy": 22`; verified programmatically: all values are positive integers, and every key is also a key in `src/data/commit-order.json` (no orphan keys).
- `tests/commit-counts.test.ts` exists and passes (gate, see below).
- Gate: `pnpm vitest run tests/commit-counts.test.ts` → 2/2 passed. `pnpm typecheck` → exit 0.

## projects-sort-by-commit-count (1058) — VERIFIED

- `src/data/projectsView.ts:23,26,28-30` imports `commit-counts.json`, defines `COMMIT_COUNTS` and `commitCount(slug)` (returns `COMMIT_COUNTS[slug] ?? 0`).
- `src/data/projectsView.ts:181` — `HUB_CARDS` sort is `commitCount(b.slug) - commitCount(a.slug) || b.lastCommitAt - a.lastCommitAt` (commit count desc, tie-break last-commit desc).
- `src/data/projectsView.ts:33-41` — `PUBLIC_SLUGS` includes `'academy'`; comment updated to "6 named projects".
- `src/pages/ProjectsPage.tsx` — no `commitCount`/`commit-count` identifier found anywhere in the file body (only the updated header-comment prose at line 12, which doesn't render); `HubCard` interface (`projectsView.ts:50-76`) carries no count field, so nothing is exposed for `ProjectsPage.tsx` to render. "Last commit" date cell untouched.
- `tests/projects-order.test.ts` exists and passes; `tests/open-core-positioning.test.ts` still passes (gate, see below).
- Gate: `pnpm vitest run tests/projects-order.test.ts tests/open-core-positioning.test.ts` → 21/21 passed (3 + 18). `pnpm typecheck` → exit 0.

## Combined-diff checks

- `pnpm typecheck` (`tsc --noEmit`) → exit 0, no diagnostics.
- `pnpm build` (`vite build && tsc -p tsconfig.server.json`) → succeeded, bundle emitted.
- `pnpm test` (full suite) → **48 test files, 645 tests, all passed** (includes all four new test files plus every pre-existing test, e.g. `academy-quota.test.ts`, `academy-no-pii-logging.test.ts`, which still pass since `server/routes/academy.ts` was explicitly out of scope and untouched).
- No remaining import of deleted Academy files: `grep -rn "AcademyPage\|AcademyLevelPage\|academy/lessons\|components/academy" src/` → clean.
- No commit count rendered on `/projects`: confirmed above (ProjectsPage.tsx and HubCard interface both clean).
- Footer/nav still lists every remaining section: `Layout.tsx` footer renders `SECTIONS.slice(0,3)` + `SECTIONS.slice(3)` = all 5 of `home, projects, blog, workflows, contact`; `activeSectionPath` has matching branches for the survivors.
- `git diff <base>..HEAD --stat`: 16 files changed, 193 insertions, 729 deletions — scoped exactly to the four PRDs' declared `# Files` lists (plus the two deleted-file pairs each PRD named). No stray files touched.

## Review (self-review; `/code-review` and `/security-review` slash commands not available to this persona's toolset)

Read the full diff for the four non-deletion-heavy files (`scripts/refresh-commit-order.ts`, `src/App.tsx`, `src/components/Layout.tsx`, `src/data/portfolio.ts`, `src/data/projectsView.ts`, `src/pages/ProjectsPage.tsx`) plus the deletion diffs.

- `commitCount()` in `refresh-commit-order.ts` uses `execFileSync` with an argument array (no shell interpolation) — same pattern as the pre-existing `lastCommitISO`, so no command-injection surface was introduced.
- `RedirectAcademyToCourse` correctly uses `window.location.replace` (not `.href`) so `/academy` does not linger in browser history, matching the PRD's explicit requirement and the existing `MaybeStandaloneRedirect` full-page-load convention.
- `/academy/*` wildcard route covers the old `/academy/:level` paths; no dangling route left unredirected.
- No secrets, no path traversal, no SQL/user-input handling touched by this diff — all four PRDs are static data/view-layer changes.
- No duplication: `commitCount()` in the script mirrors `lastCommitISO`'s guard/error pattern by design (per PRD instruction), and the view-layer `commitCount(slug)` helper in `projectsView.ts` is a trivial one-line lookup, not a candidate for extraction.

## Findings

None — no Critical, Important, or Minor findings.

## Verdict

VALIDATION: academy-retire-inrepo-pages VERIFIED
VALIDATION: academy-drop-nav-section VERIFIED
VALIDATION: projects-commit-counts-sidecar VERIFIED
VALIDATION: projects-sort-by-commit-count VERIFIED
SCHEDULER_VERDICT: PASS

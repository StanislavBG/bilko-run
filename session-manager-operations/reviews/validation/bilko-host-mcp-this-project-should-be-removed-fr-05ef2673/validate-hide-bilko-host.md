# Validation: hide-bilko-host-from-projects

Base: 2d781ec (known). Commit for the PRD: 77009d2 (2 files: `src/data/standalone-projects.json`, `tests/projects-view.test.ts`).

## hide-bilko-host-from-projects — VERIFIED

- AC1 (`"public": true` removed, nothing else changed): `git show 77009d2` shows only the `"public": true` line and the preceding trailing comma removed from the bilko-host entry. JSON parses (`node JSON.parse` ok).
- AC2 (test row removed, test passes): the diff removes `['bilko-host', 'Bilko Host MCP']` from EXPECTED; `pnpm vitest run tests/projects-view.test.ts` → 1 passed.
- AC3 (ENRICH kept): `src/data/projectsView.ts:80` still has `'bilko-host': {`; not in the diff.
- AC4: `pnpm test` → 89 files, 1041 tests passed; `pnpm typecheck` → no errors.
- Gate re-run (both lines, foreground): green. A fresh `pnpm install --frozen-lockfile` was needed first because the worktree had no node_modules.

## Review of combined diff

`git diff 2d781ec..HEAD --stat` (excluding scheduler state): 2 files, +1/−3. Self-review (data/test-only change): no input handling, secrets, or path concerns; no duplicated helpers.

## Findings

- Critical: none.
- Important: none.
- Minor: the original run never observed the test red before the JSON edit (noted in the executor's report); the final state is correct regardless.

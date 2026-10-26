# Validation: projects-view-test-registry-agnostic

Base: 4fdfef6f. Commit: 25a0155d (only tests/projects-view.test.ts changed). PRD: prds-archived/1546-projects-view-test-registry-agnostic.md.

## projects-view-test-registry-agnostic — VERIFIED

- No hardcoded EXPECTED list: `grep EXPECTED tests/projects-view.test.ts` returns nothing.
- Slug-set equality vs `PROJECTS.filter(public === true)`: tests/projects-view.test.ts:13-16.
- Name equals `displayName ?? name` from PROJECTS, no literals: tests/projects-view.test.ts:18-21.
- Non-increasing commit count order, missing slug = 0: tests/projects-view.test.ts:23-28.
- Other tests unchanged: `git show 25a0155d` diff touches only the import, the constants, and the one describe's test.
- Gate `timeout 200 pnpm vitest run tests/projects-view.test.ts`: 8 passed (8).

## Findings

- Critical: none. Important: none.
- Minor: the order check uses `>=` on counts only, so it does not cover the lastCommitAt tie-break (within the PRD's scope).
- Minor: not run against the origin/main state with academy displayName 'Bilko Academy'. Name assertion is registry-derived, so it holds either way.

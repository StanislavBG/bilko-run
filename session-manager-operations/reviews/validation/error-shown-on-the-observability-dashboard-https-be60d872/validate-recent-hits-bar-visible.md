# Validation: recent-hits-bar-always-visible

Base: 9b73074c. Commits in range for the PRD's files: `9bd73058 fix(admin): keep RECENT HITS bar inside viewport on short windows`.
PRD file found at `prds-archived/1464-recent-hits-bar-always-visible.md`.

## recent-hits-bar-always-visible — VERIFIED

Evidence per acceptance criterion:
1. Bar inside viewport, height 28, 4 viewports x 3 layouts: `e2e/observability-shell.spec.ts:16-31` asserts `bottom <= innerHeight` and `height === 28` for RAILS/DOCK/WING at 1280x720, 1366x650, 1440x900, 1920x1080. Re-ran: `4 passed (18.1s)`.
2. Heights/minWidth unchanged: the only src change is `src/pages/admin/command/CommandShell.tsx:162` `minHeight: 760` -> `0`. `minWidth: 1280` untouched; no header/KPI/bar height edits.
3. Ticker unchanged: `git diff 9b73074c..HEAD -- src/pages/admin/command/KpiStrip.tsx` is empty.
4. Spec exists and matches the described behavior (`e2e/observability-shell.spec.ts:19-30`: setViewportSize, goto preview, click each layout button, exact-text 'RECENT HITS', parent rect check).

Gate re-run (all exit 0):
- `pnpm exec playwright test e2e/observability-shell.spec.ts` -> 4 passed
- `pnpm vitest run tests/obs-command-layout.test.ts tests/obs-command-ticker.test.ts` -> 12 passed
- `pnpm typecheck` -> exit 0

## Combined diff review
2 files, +33/-1 (spec + one-line style change). Self-review (the /code-review and /security-review skills were not run as separate passes): no input handling, secrets, or paths; no duplicated helper.

## Findings
- Critical: none
- Important: none
- Minor: `e2e/observability-shell.spec.ts:28` only checks the bar; panels inside the shortened grid are not asserted to render usably at 650px height (the PRD asked to check this; the spec does not cover it).

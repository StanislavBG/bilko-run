# Validation: Observability Command fix wave

Base: 837d52ad. Commits: 138e2fb2 (1406), e08b11ef (1404), de4d14db (1405). All three PRD files found under `prds-archived/`. Gates re-run in this worktree (vitest present).

## obs-cmd-fix-donut-appstats (1406) — VERIFIED
- AC1 merge of 'other'/empty/null: `AudienceModule.tsx:20-36` (`isOther` + single `other` bucket sums named tail and other rows). Test covers it.
- AC2 center = largest named segment: `AudienceModule.tsx:37` slices to named segments before the max reduce; used by both donuts via the shared function.
- AC3 `fmtNum` on tiles: `AppsModule.tsx:227`; `fmtCompact` removed. Overflow at 1440x900 not checked (no browser run).
- AC4 tests: `tests/obs-command-audience.test.ts` has 5 tests, all pass.
- Gate: `pnpm vitest run tests/obs-command-audience.test.ts` → 5/5 passed; `pnpm typecheck` → exit 0.

## obs-cmd-fix-brand-sesscount (1404) — VERIFIED (screenshot not re-verified)
- AC1: `CommandShell.tsx:195` brand `whiteSpace: nowrap, flex: none`; `:200` `// COMMAND` rendered only when `wide` (`innerWidth >= 1360`, resize listener at `:105-109`).
- AC2: `SessionsModule.tsx:103-105` records unfiltered count keyed by `days`; `:232` shows `{list.length} / {total}` and falls back to `list.length` when the window differs, so it resets on window change. Equal when filter empty.
- AC3: the 1280x760 screenshot was not committed and not re-run here; only the code change was checked.
- Gate: `pnpm typecheck` → exit 0.

## obs-cmd-vite-ignore-scheduler (1405) — VERIFIED
- AC1: `vite.config.ts:36-39` adds `watch.ignored: ['**/session-manager-operations/**']`; port 3002 and /api, /og proxies untouched (diff is additive only).
- AC2: ran vite on port 3917, touched `session-manager-operations/.vite-watch-probe` 5 times at 3s intervals (probe removed afterwards); `grep -c 'page reload.*session-manager-operations'` on the log = 0. Shorter than the PRD's 30s, and no positive control without the fix.
- Gate: `pnpm typecheck` → exit 0.

## Findings
- Minor — `SessionsModule.tsx:232`: when a filter is already active before the first unfiltered fetch for a window, total equals shown (no unfiltered count known) until the filter is cleared. `Math.max` also hides a stale total. Acceptable approximation.
- Minor — `AppsModule.tsx:23-24`: blank-line residue after removing `fmtCompact` (double blank line).
- Minor — `CommandShell.tsx:105`: `window.innerWidth` in a `useState` initializer would throw under SSR; this admin page is client-only, so no impact.
- No security issues found in the diff (no new input handling, secrets, or paths).

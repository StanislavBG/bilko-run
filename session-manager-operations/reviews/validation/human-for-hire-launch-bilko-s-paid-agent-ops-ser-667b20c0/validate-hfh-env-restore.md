# Validation: 1507-hfh-agent-buy-env-restore

Base: a0f45e56. Commits in scope: 4ccfb6f9 (only `tests/agent-buy.test.ts`, +5/-2). PRD found in `prds-archived/`.

## 1507-hfh-agent-buy-env-restore — VERIFIED

- AC1 (restore + module-scope OLD_ENV): `tests/agent-buy.test.ts:4` `const OLD_ENV = process.env;` at module scope, before any mutation. `:39` `afterEach(() => { process.env = OLD_ENV; })`, `:40` `afterAll(() => { process.env = OLD_ENV; })`. The old describe-scoped `OLD_ENV` was removed. `beforeEach` (`:42-`) still builds `{ ...OLD_ENV, ... }`.
- AC2 (assertions unchanged): the diff touches only imports, the OLD_ENV declaration and the two hooks. No assertion lines changed. `pnpm vitest run tests/agent-buy.test.ts` gave 19/19 passed.
- AC3 (full suite green twice): `pnpm vitest run` run 1 gave 144 files and 1608 tests passed (2 files and 14 tests skipped). Run 2 gave the same counts.
- Typecheck: `pnpm typecheck` (client, server and scripts tsc) produced no errors.
- Gate commands (agent-buy file, full suite twice) were re-run in order and all passed.

## Findings

Critical: none.
Important: none.
Minor:
- `tests/agent-buy.test.ts:39-40`: `afterEach` already restores the env, so `afterAll` is redundant. It is harmless and the PRD asked for it.
- `/code-review` and `/security-review` were not run. The diff is test-only, so I self-reviewed it: no secrets, no input handling, and the price ids are fake values.
- The dev-lead reported that `tests/coffee-checkout.test.ts` (lines 85, 118, 158) and `tests/stripe-checkout-success.test.ts` (lines 74, 132, 219, 292) assign `process.env` and may not restore it. They are outside this PRD and I did not check them. They could be a source of similar cross-file flakes.

# Validation: host-kit-telemetry-env (PRD 1677)

Base: no `Base:` line in the validate PRD; located the landing commit by path history: `9891d35a feat(host-kit): stamp telemetry records with env (prod, dev, test)` (7 files, all in the PRD's # Files).

## host-kit-telemetry-env — VERIFIED

- AC1 `TelemetryEnv`, `resolveEnv()`, `InitOpts.env`: packages/host-kit/src/telemetry.ts (`onBilkoHost` → 'prod'; then `navigator.webdriver === true` → 'test'; else 'dev'; typeof guards for SSR); `validEnv()` ignores non-members; `env?: TelemetryEnv` in InitOpts. Exported from src/index.tsx.
- Order: hostname first (bilko.run + webdriver → prod, tested). Env is set after the spread: `cfg = { ..., ...opts, env: validEnv(opts.env) ?? resolveEnv() }` (telemetry.ts:127), so an undefined opts.env cannot clobber it.
- AC2 env on all payloads: `env: cfg.env` on error (≈l.164), event (≈l.190), log (≈l.228) payloads; cfg resolved once in initTelemetry, which track() auto-init calls (test "track() auto-init resolves env once").
- AC3 tests: packages/host-kit/tests/telemetry.test.ts `describe('env')` — it.each covers bilko.run, www, localhost, 127.0.0.1, localhost+webdriver, bilko.run+webdriver; override on bilko.run; invalid 'staging' ignored; flushed batch env on event/log/error.
- AC4 tests/host-track-flow.test.ts:80 stores 'dev' and NULL for 'bogus'. `git diff 9891d35a^ HEAD -- server/routes/telemetry.ts` is empty (untouched).
- AC5 docs: packages/host-kit/README.md and docs/host-contract.md describe env, order, override, and that older host-kit rows (no env) count as prod.
- AC6 .changeset/host-kit-telemetry-env.md: `"host-kit": minor`.
- Gate (re-run): `pnpm --filter host-kit run test` → 7 files, 50 tests passed; `pnpm vitest run tests/host-track-flow.test.ts` → 4 passed. Both exit 0.

## Findings

- Critical: none.
- Important: none.
- Minor: no `Base:` line in the validate PRD, so history was found by path. PRD 1677's own typecheck gate step was not in this validation's gate and was not re-run.
- Minor: README says "before 0.11.0" and host-contract says `>=0.11.0`; the changeset only declares "minor", so the version number depends on the release PRD (1679).
- Review: self-review of the diff (no env-value injection: env is whitelisted; no secrets; no path handling). Nothing flagged.

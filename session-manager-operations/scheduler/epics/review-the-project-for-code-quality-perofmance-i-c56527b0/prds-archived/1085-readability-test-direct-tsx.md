---
title: Test suite: run the blog-readability CLI tests without npx (cut ~10s)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-09T19:43:36.679Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1dia5j-f24b1b
---
# Goal

behavior. tests/blog-readability.test.ts takes ~16s because two CLI tests (around lines 275-305) spawn `npx tsx scripts/blog-readability.ts`, and npx resolution dominates. Spawn the locally installed tsx CLI directly with `process.execPath` instead.

# Acceptance criteria

- [ ] tests/blog-readability.test.ts no longer calls `npx`; the two CLI tests run `execFileSync(process.execPath, [<resolved tsx cli path>, 'scripts/blog-readability.ts', file], ...)` where the path is resolved via `createRequire(import.meta.url).resolve('tsx/cli')` (or the tsx package's documented cli entry if that export differs).
- [ ] Both CLI tests keep their existing assertions (exit 1 on the failing fixture, exit 0 on the passing one).
- [ ] `pnpm vitest run tests/blog-readability.test.ts` completes in under 8 s (report before/after).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- tests/blog-readability.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: tests/blog-readability.test.ts lines 1-20 and 270-307; node_modules/tsx/package.json `exports` (find the CLI entry).

Steps: measure; replace both `execFileSync('npx', ['tsx', ...])` calls; keep cwd and timeout options; measure again.

Do not touch: scripts/blog-readability.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm vitest run tests/blog-readability.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

---
title: Blog watchdog: make the spotlight fallback mode-aware in catch-up mode
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T08:27:58.279Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
disposition: new-head
planId: pl-mus4qaiv-8b53ae
---
# Goal

behavior. Validator finding (Important) on PRD 1016, record session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-language-cadence.md: in scripts/blog-cadence-watchdog.sh around line 538, the COOLDOWN_INSTRUCTIONS spotlight branch tells the agent to "write the spotlight post described in the mode instructions above", but in catch-up mode MODE_INSTRUCTIONS never describes a spotlight post — a self-contradictory prompt when the gap is 10+ days, all new-work projects are on cooldown, and spotlight candidates exist. Make it consistent.

# Acceptance criteria

- [ ] In catch-up mode, MODE_INSTRUCTIONS in scripts/blog-cadence-watchdog.sh describes the spotlight fallback too: if the backfill queue would be empty (no eligible new work), write ONE spotlight post on the first spotlight candidate, dated AUTHORED_AT (not backdated)
- [ ] COOLDOWN_INSTRUCTIONS' spotlight branch text no longer depends on wording that only exists in portfolio mode — it names the spotlight candidates and the rule itself, so it reads correctly in both modes
- [ ] tests/blog-cadence-watchdog.test.ts gains a test that builds the prompt (or the instruction strings) for MODE=catchup with non-empty spotlight candidates and asserts the catch-up instructions mention spotlight and the first candidate; follow the existing harness used for spotlight_candidates
- [ ] All existing tests in tests/blog-cadence-watchdog.test.ts and tests/blog-watchdog-heartbeat.test.ts still pass; bash -n passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- tests/blog-cadence-watchdog.test.ts

# Implementation notes

Read first: scripts/blog-cadence-watchdog.sh lines 500-600 (MODE selection, MODE_INSTRUCTIONS, SPOTLIGHT_CANDIDATES_TOP3, COOLDOWN_INSTRUCTIONS, REQUIREMENTS), tests/blog-cadence-watchdog.test.ts (the spotlight_candidates tests added by commit 2903bcd — reuse their sourcing harness), the validation record named in the goal.

Steps: red test first; then edit the catch-up MODE_INSTRUCTIONS and the COOLDOWN_INSTRUCTIONS spotlight branch. If the instruction strings are not reachable from a test as-is, extract a small pure function (e.g. `build_mode_instructions <mode> <gap> <newest> <spotlight_csv>`) and call it at the original site.

Do not touch: the state-file lock logic (next PRD), scripts/check-blog-watchdog-heartbeat.sh, blog.config.yaml. Never run the watchdog for real.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

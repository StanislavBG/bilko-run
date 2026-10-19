---
title: Blog watchdog: put ~/.npm-global/bin on PATH and preflight every required binary
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:04:14.701Z
sourcePromptId: blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964
agentType: dev-lead
disposition: new-head
planId: pl-mv5x50j1-471a98
---
# Goal

primitive + wire. scripts/blog-cadence-watchdog.sh has failed every run since 2026-10-03 because systemd's user PATH lacks /home/bilko/.npm-global/bin, so `timeout 180 pnpm tsx scripts/blog-cadence-gate.ts next-slot` exits 127 and the heartbeat says only "error: cadence gate unavailable". Move the watchdog's PATH setup into a new sourced file scripts/blog-watchdog-env.sh that adds ~/.npm-global/bin and defines a binary preflight, and make the watchdog fail fast with a distinct "error: missing binary <names>" heartbeat when any required binary is unresolvable. Prove it with a behavioral test that sources the env file under a bare systemd-like environment.

# Acceptance criteria

- [ ] New scripts/blog-watchdog-env.sh exports PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH", defines array WATCHDOG_REQUIRED_BINARIES=(awk claude curl flock git jq node npx pnpm timeout) and function watchdog_missing_binaries that echoes the space-separated names not resolvable via `command -v` (empty output when all resolve). It has a header comment with the 2026-10-03 to 2026-10-12 rc=127 postmortem.
- [ ] scripts/blog-cadence-watchdog.sh no longer has its own `export PATH="$HOME/.local/bin:$PATH"` line (currently line 84); in its place it sources scripts/blog-watchdog-env.sh (path relative to the repo root, which the script has already cd'd into).
- [ ] scripts/blog-cadence-watchdog.sh, immediately after `trap on_exit EXIT` and before the LOCKFILE/flock block, calls watchdog_missing_binaries; when non-empty it echoes a `[blog-cadence-watchdog] FATAL: required binaries not on PATH: <names> (PATH=...)` line to stderr, calls `write_heartbeat "error: missing binary <names>"` and exits 1.
- [ ] New tests/blog-watchdog-env.test.ts (vitest) spawns `env -i HOME=<tmpdir> PATH=/usr/bin:/bin bash -c 'source <repo>/scripts/blog-watchdog-env.sh; watchdog_missing_binaries'` and asserts: (a) with executable stub files <tmpdir>/.npm-global/bin/pnpm and <tmpdir>/.local/bin/claude present, the output does not contain `pnpm` or `claude`; (b) with those stubs absent, the output contains both `pnpm` and `claude`. Assertions must not depend on node/npx/jq living in /usr/bin (CI installs node elsewhere) — only assert on pnpm and claude.
- [ ] tests/blog-watchdog-env.test.ts has one test guarded by `it.skipIf(!existsSync(join(homedir(), '.npm-global/bin/pnpm')))` that runs `env -i HOME=$HOME PATH=/usr/bin:/bin bash -c 'source scripts/blog-watchdog-env.sh && timeout 180 pnpm tsx scripts/blog-cadence-gate.ts next-slot'` with cwd = repo root and asserts exit 0 and stdout matching /^\d{4}-\d{2}-\d{2}T/.
- [ ] tests/blog-cadence-watchdog.test.ts still passes unchanged (its static-text checks must not regress); the gate commands below exit 0.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-watchdog-env.sh
- scripts/blog-cadence-watchdog.sh
- tests/blog-watchdog-env.test.ts

# Implementation notes

Read first: scripts/blog-cadence-watchdog.sh lines 80-100 (PATH line, write_heartbeat) and 310-330 (on_exit trap, LOCKFILE/flock); scripts/sanity-qa-cron.sh lines 6-11 (precedent PATH fix for the same cause); tests/blog-watchdog-heartbeat.test.ts lines 1-70 (execFileSync + tmpdir test pattern to copy).

Steps:
1. Create scripts/blog-watchdog-env.sh (no `set -e` inside; it is sourced). Add `# shellcheck source=scripts/blog-watchdog-env.sh` above the source line in the watchdog.
2. In scripts/blog-cadence-watchdog.sh replace the two lines `# cron runs with a bare PATH; the claude CLI lives in ~/.local/bin.` / `export PATH="$HOME/.local/bin:$PATH"` with a short comment + `source "scripts/blog-watchdog-env.sh"`.
3. Insert the preflight block between `trap on_exit EXIT` and `LOCKFILE=...`. It must run before the lock so a missing binary is reported even on the first line of work.
4. Write tests/blog-watchdog-env.test.ts. Use mkdtempSync for the fake HOME; write stubs as `#!/bin/sh\nexit 0\n` with mode 0o755. Never invoke curl, claude -p, or the watchdog script itself (it calls production bilko.run). The skipIf test only runs the local cadence gate, which reads local files.

Facts: on this machine `which pnpm` = /home/bilko/.npm-global/bin/pnpm, claude = /home/bilko/.local/bin/claude; systemd user PATH = /home/bilko/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin.

Do not touch: scripts/check-blog-watchdog-heartbeat.sh, tests/blog-watchdog-heartbeat.test.ts, docs/blog-watchdog.md (a sibling PRD owns them).

# Out of scope

- Changing cadence targets, rotation/cooldown rules, or the content DAG
- Changing the heartbeat checker or its alerting
- Editing any systemd unit file under ~/.config/systemd/user

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-watchdog-env.test.ts tests/blog-cadence-watchdog.test.ts
timeout 60 bash -n scripts/blog-cadence-watchdog.sh && timeout 60 bash -n scripts/blog-watchdog-env.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

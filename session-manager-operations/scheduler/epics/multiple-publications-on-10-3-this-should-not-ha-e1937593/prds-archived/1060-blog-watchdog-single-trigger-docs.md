---
title: Docs: systemd timer is now the only blog watchdog trigger (crontab entry removed)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-03T22:26:33.459Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
planId: pl-musyopyr-19bd0f
---
# Goal

doc: on 2026-10-03 at 3:26 PM PDT the owner had the duplicate crontab trigger for scripts/blog-cadence-watchdog.sh removed (`0 12 * * * ... # bilko blog-cadence-watchdog`; backup at ~/.claude/backups/crontab-20261003-152617.bak). The systemd user timer blog-cadence-watchdog.timer (OnCalendar=daily, Persistent=true) is now the only trigger. Update the docs and script comments so they describe one trigger, not two.

# Acceptance criteria

- [ ] `docs/blog-watchdog.md` schedule table lists only the systemd timer (and the separate heartbeat-check timer); the crontab row and the 'redundant — recommend removing' prose are replaced by one sentence recording that the crontab entry was removed 2026-10-03 at the owner's request, and that a crontab trigger must not be re-added (one trigger only).
- [ ] `docs/blog-watchdog.md` names the single log, .claude/skills/blog-from-git/drafts/.watchdog.log, and says ~/.claude/logs/blog-cadence-watchdog.log is historical only.
- [ ] `scripts/blog-cadence-watchdog.sh` header comment (around line 32) and the comment near line 345 no longer describe a crontab trigger; script logic is unchanged.
- [ ] `tests/blog-cadence-watchdog.test.ts` still passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/blog-watchdog.md
- scripts/blog-cadence-watchdog.sh

# Implementation notes

Read first: docs/blog-watchdog.md (whole), scripts/blog-cadence-watchdog.sh lines 1-60 and 340-350. Comment-only change in the script — do not alter any executable line. Do not touch the user crontab or systemd units (already done by the owner).

Do not touch: anything under .claude/skills/, server/, tests/ (other than running them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

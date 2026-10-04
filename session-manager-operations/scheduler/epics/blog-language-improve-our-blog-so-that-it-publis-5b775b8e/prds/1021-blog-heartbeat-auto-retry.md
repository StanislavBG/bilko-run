---
title: Blog heartbeat check: auto-retry the watchdog when the blog is overdue and the last run warned or errored
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T08:28:28.514Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-watchdog-lock-after-publish]
planId: pl-mus4qaiv-8b53ae
---
# Goal

behavior. scripts/check-blog-watchdog-heartbeat.sh runs every 6 hours (systemd blog-watchdog-heartbeat-check.timer) and today only prints CRITICAL/WARNING and exits 1 when the watchdog heartbeat is `error:` or `warn:` — nobody acts on it. On 2026-09-29 and 09-30 the watchdog failed on a Claude usage limit and nothing retried after the limit reset. Make the check self-heal: when the latest heartbeat is error:/warn:, start one extra watchdog run, rate-limited.

# Acceptance criteria

- [ ] When the heartbeat status is error: or warn:, check-blog-watchdog-heartbeat.sh starts a retry with `systemctl --user start --no-block blog-cadence-watchdog.service` and logs one line saying so; it still exits 1 so the failure stays visible
- [ ] Retries are rate-limited by a marker file in .claude/skills/blog-from-git/drafts/ (e.g. .watchdog-retry) holding the last retry epoch: at most one retry per 6 hours and at most 3 per PT calendar day; when the limit is hit it logs that and does not start a run
- [ ] No retry when the heartbeat is ok:, stale (watchdog dead — keep current behavior), or when blog-cadence-watchdog.service is already active (check with systemctl --user is-active)
- [ ] The retry decision is a pure function (e.g. `should_retry <status> <now_epoch> <marker_contents> <service_active>`) tested in tests/blog-watchdog-heartbeat.test.ts for: error => retry, warn => retry, ok => none, within 6h of last retry => none, 3 retries today => none, service active => none; tests never call real systemctl (stub via a SYSTEMCTL env var override defaulting to systemctl)
- [ ] Existing tests in tests/blog-watchdog-heartbeat.test.ts pass; bash -n passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/check-blog-watchdog-heartbeat.sh
- tests/blog-watchdog-heartbeat.test.ts

# Implementation notes

Read first: scripts/check-blog-watchdog-heartbeat.sh (whole, 82 lines), tests/blog-watchdog-heartbeat.test.ts (harness), scripts/blog-cadence-watchdog.sh lines 75-100 (HEARTBEAT_FILE location and format `<ISO-8601 PT timestamp> <status text>`).

Context: the previous PRD (blog-watchdog-lock-after-publish) made the watchdog clear its same-day lock unless a post was actually seeded, so a retried run on the same day CAN publish. A noop heartbeat is written as `warn:` when over cadence, so this also retries skipped due-days.

Steps: red tests for should_retry; add it plus a source-guard like the watchdog script uses so tests can source it; wire it into the error:/warn: branches before their exit 1.

Do not touch: scripts/blog-cadence-watchdog.sh, systemd unit files, crontab. Never start the real service during the run.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 bash -n scripts/check-blog-watchdog-heartbeat.sh
timeout 300 pnpm vitest run tests/blog-watchdog-heartbeat.test.ts tests/blog-cadence-watchdog.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

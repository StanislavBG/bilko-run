# Validation: blog-watchdog-single-trigger-docs

Base: `45a960b`. PRD source (not tracked by git — scheduler-local state):
`session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds-archived/1060-blog-watchdog-single-trigger-docs.md`
(found in the main checkout at `/home/bilko/Projects/Bilko/...`; this epic directory is untracked
scheduler state and does not exist in this isolated worktree).

Commits in scope: `git log --oneline 45a960b..HEAD -- docs/blog-watchdog.md scripts/blog-cadence-watchdog.sh`
→ one commit, `559dafd docs(blog-watchdog): document single systemd-timer trigger, drop crontab`.
Matches the scheduler's recorded `landedCommit` for this PRD in
`session-manager-operations/scheduler/state/history.jsonl`.

## PRD: 1060-blog-watchdog-single-trigger-docs — VERIFIED

| # | Acceptance criterion | Evidence |
|---|---|---|
| 1 | `docs/blog-watchdog.md` schedule table lists only the systemd timer; crontab row/"redundant" prose replaced by one sentence recording the 2026-10-03 removal and "do not re-add" | `docs/blog-watchdog.md:9-18` — table has one row (`systemd user timer (sole trigger)`); line 15-18: "A duplicate crontab entry ... was removed on 2026-10-03 at 3:26 PM PDT at the owner's request ... **Do not re-add a crontab trigger for this script — one trigger only.**" |
| 2 | Doc names the single log (`.claude/skills/blog-from-git/drafts/.watchdog.log`) and says `~/.claude/logs/blog-cadence-watchdog.log` is historical only | `docs/blog-watchdog.md:25-27`: "The single log this script writes to is `.claude/skills/blog-from-git/drafts/.watchdog.log`. `~/.claude/logs/blog-cadence-watchdog.log` is historical only — it was written by the now-removed crontab trigger and is no longer appended to." |
| 3 | `scripts/blog-cadence-watchdog.sh` header comment (~line 32) and comment near line 345 no longer describe a crontab trigger; script logic unchanged | `scripts/blog-cadence-watchdog.sh:27-38` (post-edit) replaces the old "TRIGGERS — TWO independent schedulers" block with "TRIGGER — this script runs from exactly ONE scheduler ... A previously-installed crontab entry was removed 2026-10-03 ... do not re-add". Line 343-344: "...hard-wired to whatever triggers it (the daily systemd timer, docs/blog-watchdog.md)..." (previously "the daily systemd timer / crontab entry"). Confirmed via `git diff 45a960b..HEAD --unified=0 -- scripts/blog-cadence-watchdog.sh \| grep -E '^[+-]' \| grep -v '^+++\|^---' \| grep -vE '^\+#\|^-#'` → empty (exit 1): every changed line is a `#` comment line; zero executable lines touched. (Pre-existing, out-of-scope "cron" mentions remain elsewhere in the file — e.g. lines 64/66/83/354/654/688/704/738/797 — but the PRD's AC named only the two specific comment blocks, both of which were corrected; these other mentions were not part of the AC and were not touched by the commit, consistent with "script logic is unchanged".) |
| 4 | `tests/blog-cadence-watchdog.test.ts` still passes | Ran `pnpm install --frozen-lockfile` (node_modules was absent in this worktree) then `timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts` → `Test Files 1 passed (1)`, `Tests 101 passed (101)`. |

### Gate (re-run, both from the PRD)

```
$ timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts
✓ tests/blog-cadence-watchdog.test.ts (101 tests) 930ms
Test Files  1 passed (1)
Tests  101 passed (101)

$ timeout 60 bash -n scripts/blog-cadence-watchdog.sh
(exit 0, no output)
```

### Live-environment checks named in this validation's own acceptance criteria

```
$ timeout 30 crontab -l | grep -i blog-cadence-watchdog
(no match — "no blog-cadence-watchdog line in crontab")

$ timeout 30 systemctl --user is-enabled blog-cadence-watchdog.timer
enabled
```

Both confirm the doc's and script's claims reflect real, current machine state: the crontab
trigger is gone, and the systemd timer is the one enabled trigger.

## Diff review

`git diff 45a960b..HEAD --stat -- docs/blog-watchdog.md scripts/blog-cadence-watchdog.sh`:
`docs/blog-watchdog.md | 57 ++++++++++++++++-----------------------`,
`scripts/blog-cadence-watchdog.sh | 33 +++++++++++------------` (2 files, 40 insertions, 50 deletions).

Read the full diff for both files. The script's half is comment-only (verified above by the `+/-`
grep excluding `#` lines); the doc's half replaces the "two schedulers" narrative with a "one
scheduler, crontab removed" narrative and is internally consistent with the script's updated
comments (same removal date, same backup path, same "one trigger" language).

Ran `/code-review` (medium) scoped to `45a960b..HEAD -- docs/blog-watchdog.md
scripts/blog-cadence-watchdog.sh`: no findings — "Diff is comment/doc-only, no executable logic
changed, and every factual claim (crontab removal, backup file, systemd timer schedule/log path,
lock filename, flock message) was cross-checked against live system state and matches exactly."

Ran `/security-review`: the diff touches only a markdown doc and shell-script comments — zero
executable lines changed (confirmed by the same `+/-` minus-`#`-lines grep used above, which
returned empty). No input handling, no new subprocess calls, no secrets, no path handling was
added or modified. No findings.

## Findings

None — Critical, Important, and Minor are all empty for this PRD's scope.

## Sentinel

VALIDATION: blog-watchdog-single-trigger-docs VERIFIED
SCHEDULER_VERDICT: PASS

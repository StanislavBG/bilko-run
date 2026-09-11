# Blog cadence watchdog — schedule, logs, and gate state

`scripts/blog-cadence-watchdog.sh` enforces the blog's declared 3-5 day publishing cadence
(`.claude/skills/blog-from-git/blog.config.yaml` `cadence.target_gap_days`) since nothing else
does — `/blog-from-git` only ever runs when a human types it. This doc is the one place that
records the real, currently-installed schedule, because the script has previously had two
schedulers and three different claimed times, none of which agreed with each other.

## The two triggers (verified on this machine 2026-09-11)

| Trigger | Definition | Fires (PT) | Log |
|---|---|---|---|
| **crontab** (redundant — see below) | `0 12 * * * /home/bilko/Projects/Bilko/scripts/blog-cadence-watchdog.sh >> /home/bilko/.claude/logs/blog-cadence-watchdog.log 2>&1 # bilko blog-cadence-watchdog` | daily, 12:00 | `~/.claude/logs/blog-cadence-watchdog.log` |
| **systemd user timer** (authoritative) | `blog-cadence-watchdog.timer` — `OnCalendar=daily`, `Persistent=true`, `AccuracySec=15min`, running `blog-cadence-watchdog.service` (`WorkingDirectory=%h/Projects/Bilko`) | daily, ~00:00-00:15 | `.claude/skills/blog-from-git/drafts/.watchdog.log` |

Both are real, both are currently installed, and both have been firing — that is why the two
logs contain different, partially overlapping histories instead of one clean trail. Neither
trigger matches "09:00 PT", which is what the script's header comment used to (incorrectly)
claim before this doc existed.

A separate, unrelated timer — `blog-watchdog-heartbeat-check.timer` — runs
`scripts/check-blog-watchdog-heartbeat.sh` roughly twice daily to detect if the watchdog itself
has gone dead or unhealthy. It doesn't invoke the watchdog; it only reads the heartbeat file the
watchdog writes on every run.

**The systemd timer is authoritative; the crontab entry is redundant.** Recommendation: drop the
crontab entry and keep the systemd timer, because `Persistent=true` survives the laptop being
closed at the timer's scheduled moment (it replays the missed run at next boot/wake), while plain
cron does not — a run simply never happens if the machine is off or asleep at 12:00 PT. This is a
recommendation for a human to act on (removing the crontab line is machine state outside this
repo, out of scope for this doc/PRD) — it is not a change this repo can make.

## Both triggers are LOCAL to this machine

Neither the crontab entry nor the systemd timer exists anywhere except this laptop. Both only
fire while this machine is powered on and, for the crontab entry specifically, awake at the exact
scheduled minute — there is no server-side or cloud equivalent keeping the cadence on days this
machine is off. The `Persistent=true` systemd timer setting narrows but does not eliminate this
gap: it replays a run that was missed while the machine was off, once the machine is next on, but
a run genuinely cannot happen while the machine has no power at all.

## Why the duplication is currently harmless, not dangerous

Two schedulers firing independently sounds like it should cause double-drafting or duplicate
runs, but two safeguards make simultaneous/overlapping triggers a safe no-op:

- **Concurrency lock**: `/tmp/bilko.blog-cadence-watchdog.lock` via `flock -n`. If the crontab
  trigger and the systemd trigger ever overlapped, the second to acquire the lock exits
  immediately with `"another instance running — skipping"` and still writes a heartbeat.
- **Same-day idempotency**: `.watchdog-state` (`.claude/skills/blog-from-git/drafts/.watchdog-state`)
  records the date of the last drafting run. A second run later the same day — whether triggered
  by the other scheduler or a manual rerun — sees today's date already recorded and exits without
  invoking `claude -p` again.

So running the watchdog twice a day (once from cron at 12:00, once from systemd at ~00:00) wastes
at most one skipped invocation's worth of a few seconds of shell/curl work — it never produces two
drafts, two `claude -p` calls, or diverging state.

## Is publishing autonomous or gated?

**Gated.** As of this doc (2026-09-11), `.claude/skills/blog-from-git/blog.config.yaml` has no
`autonomy.autonomous_publish` key at all — only a comment on line 20 that references it
conditionally ("applies ONLY when autonomy.autonomous_publish is false"). The absence of that key
means the human-approval gate described in the script itself is still in force: the watchdog runs
phases 1-5 only (Rotation, Scan, Research, Ground, Draft) and explicitly stops before phase 6
(Approve) and phase 7 (Seed) — it never edits `server/db.ts` or `blog-ledger.md`, never commits,
never pushes, never publishes. A sibling PRD (1007) is expected to remove this gate; when it
lands, this doc's "Gated" verdict and the `autonomy.autonomous_publish` key's presence/value in
`blog.config.yaml` will both need to be re-checked and this section updated to match.

## Where drafts land

Finished drafts are written to `.claude/skills/blog-from-git/drafts/<published-date>-<slug>.md`.
Nothing downstream (seeding, publishing) touches a draft until a human reviews it and explicitly
tells Claude (interactively) to seed it, per the human-gate instructions in the script itself and
in `.claude/skills/blog-from-git/SKILL.md`.

---
title: Guarantee the blog watchdog actually fires: persistent systemd timer, on-site gap visibility, and a dead-man heartbeat
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 60
createdVia: scheduler-api
issuedAt: 2026-08-30T00:11:13.103Z
sourcePromptId: blogs-are-behind-i-don-t-see-new-blogs-on-the-si-8d72aba1
tag: feature
dependsOn: [1001-blog-cadence-watchdog]
---
# Goal

PRD 1001 produces scripts/blog-cadence-watchdog.sh, but a script that exists is not a script that runs — and on this machine plain cron cannot guarantee it. The box is powered off for multi-hour windows (last reboot log shows a ~20h gap 2026-08-26 14:03 to 08-27 10:35), and vixie cron never replays a job missed while off. Worse, this repo already contains a dead automation nobody noticed: bilko-watchdog.timer is inactive+disabled and its ExecStart points at scripts/watchdog.sh, which does not exist. Make the blog watchdog durable on a substrate that survives downtime, and give it a failure mode that is visible rather than silent.

# Acceptance criteria

- [ ] scripts/blog-cadence-watchdog.sh is COMMITTED to git and pushed to origin/main — it is currently untracked ('?? scripts/blog-cadence-watchdog.sh'), so a git clean or fresh clone silently loses the entire fix
- [ ] The watchdog runs from a systemd USER timer, not crontab: ~/.config/systemd/user/blog-cadence-watchdog.{timer,service} with `OnCalendar=daily` and `Persistent=true`. Persistent=true is the whole point — it replays a run missed while the machine was off, which cron cannot do. `loginctl show-user bilko` already reports Linger=yes, so user timers run without an active login; mirror the existing working scheduler-watchdog.timer
- [ ] The timer is actually enabled AND started — verify with `systemctl --user is-enabled blog-cadence-watchdog.timer` returning 'enabled' and `systemctl --user list-timers` showing a real NEXT value. Do not consider the unit files existing to be sufficient; bilko-watchdog.timer proves unit files can sit disabled indefinitely
- [ ] The unit files are committed into the repo (e.g. under ops/systemd/) with an install script, so the timer is reproducible after an OS reinstall rather than existing only in ~/.config
- [ ] The watchdog writes a heartbeat (timestamp + outcome) on EVERY run, including the 'within cadence, no action' path — a watchdog that only logs when it acts is indistinguishable from a dead one
- [ ] Dead-man's switch: something independent checks that the heartbeat is fresh and surfaces it when it is not. A stale heartbeat (watchdog itself dead) must be as visible as a stale blog
- [ ] Gap is visible on-site: /admin observability shows 'days since last blog post' sourced from the live /api/blog newest published_at, colour-coded against blog.config.yaml's target_gap_days. This is the layer that would have caught the actual reported bug — 36 days of silence with nothing anywhere showing a number
- [ ] Clean up the dead precedent: either restore scripts/watchdog.sh or remove the orphaned bilko-watchdog.timer/.service pair pointing at a nonexistent script — do not leave a second disabled watchdog next to the new one
- [ ] End-to-end proof, not assertion: run `systemctl --user start blog-cadence-watchdog.service` and show it executing and writing a heartbeat; then simulate the missed-run case (e.g. `systemd-analyze calendar daily`, plus stop/start the timer) and confirm Persistent=true behaviour is configured
- [ ] The install script is idempotent — running it twice does not duplicate units or clobber an enabled timer

# Implementation notes

Evidence gathered this session that motivates each requirement — do not re-derive it:

- `crontab -l` has 22 entries, ALL social-signals-trader, and a standalone `TZ=America/New_York` line at the top. Adding the blog job there inherits that TZ trap AND the clobber risk: this repo's own ~/Projects/social-signals-trader/scripts/heal-crontab.sh exists because crontab entries have been wiped before (its comments reference a 2026-06-14 clobber incident and a 2026-07-28 shadowing incident), and heal-crontab is ITSELF currently paused/not installed. Systemd user units avoid all of this.
- `last -x reboot` shows the machine genuinely off for hours at a time between boots. Persistent=true is required, not optional.
- `loginctl show-user bilko` → Linger=yes. Confirmed: user timers fire without a login session.
- Working reference to copy: ~/.config/systemd/user/scheduler-watchdog.timer (OnBootSec/OnUnitActiveSec + Persistent=true, currently active). Anti-reference: ~/.config/systemd/user/bilko-watchdog.{timer,service} — inactive, disabled, ExecStart=/home/bilko/Projects/Bilko/scripts/watchdog.sh which does not exist.
- The 1001 script's detection logic was verified working by hand this session: it parses target_gap_days upper bound = 5 and catchup_trigger_days = 10 from blog.config.yaml, reads newest live published_at = 2026-07-24T16:00:00.000Z from https://bilko.run/api/blog, computes gap = 36 days, and correctly selects catch-up mode. All runtime deps (jq, curl, flock, timeout, claude) are present. `claude` is at ~/.local/bin/claude and is confirmed NOT on a bare cron PATH, so the script's `export PATH="$HOME/.local/bin:$PATH"` line is load-bearing — a systemd unit needs the equivalent (Environment= or the same export), since systemd's default PATH is just as bare.
- The script pins `--model claude-sonnet-5` on its `claude -p` call, satisfying shared/core.md's hard rule. Preserve that; never let it become unpinned.

For the /admin observability tile, follow the existing panels added by PRDs 995/998/999 (bandwidth/egress panel) rather than inventing a new admin surface.

Note the cadence math that makes a DAILY timer sufficient: the target upper bound is 5 days and the catch-up trigger is 10, so a single missed day is absorbed. The risk this PRD addresses is not one missed tick — it is the watchdog being uninstalled, unenabled, or silently dead for weeks, which is exactly how the reported 36-day gap happened.

# Out of scope

- Changing the watchdog's drafting logic or the blog-from-git skill's editorial phases (PRD 1001 owns the script body)
- Seeding or publishing posts — the phase 6 human gate stays
- Backfilling the existing gap (PRD 1002 owns that)
- Moving other projects' cron jobs onto systemd timers — only the blog watchdog is in scope

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).

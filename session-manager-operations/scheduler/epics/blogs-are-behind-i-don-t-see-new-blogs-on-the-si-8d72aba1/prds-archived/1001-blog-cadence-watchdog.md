---
title: Blog cadence watchdog: cron script that detects a publishing gap and queues a blog-from-git session
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 45
createdVia: scheduler-api
issuedAt: 2026-08-29T23:59:13.768Z
sourcePromptId: blogs-are-behind-i-don-t-see-new-blogs-on-the-si-8d72aba1
tag: feature
---
# Goal

The bilko.run blog has a declared 3-5 day cadence (.claude/skills/blog-from-git/blog.config.yaml `cadence.target_gap_days: [3, 5]`) but nothing enforces it — the only trigger is a human typing /blog-from-git. The last post published 2026-07-24 and the gap is now 36 days. Build a cron-driven watchdog that measures the live gap and, when it exceeds the target, produces a drafted catch-up automatically instead of silently doing nothing. The human approval gate on publishing stays: the watchdog must never seed or publish a post by itself.

# Acceptance criteria

- [ ] `scripts/blog-cadence-watchdog.sh` exists, is executable, and follows the repo's existing cron-script conventions (set -euo pipefail, flock lockfile in /tmp, `export PATH="$HOME/.local/bin:$PATH"`, log to ~/.claude/logs/blog-cadence-watchdog.log) — mirror ~/Projects/social-signals-trader/scripts/analyst-tick.sh
- [ ] The script reads the newest `published_at` from the LIVE site (`curl -s https://bilko.run/api/blog`), not from server/db.ts, and computes gap_days against now in America/Los_Angeles
- [ ] Thresholds are read from .claude/skills/blog-from-git/blog.config.yaml (`cadence.target_gap_days` and `cadence.catchup_trigger_days`) rather than hard-coded, so editorial policy stays in one place
- [ ] gap_days < upper bound of target_gap_days → script logs 'within cadence' and exits 0 with no side effects
- [ ] gap_days >= upper bound → script shells out to `claude -p` with an EXPLICIT `--model` flag (hard rule in shared/core.md — an unpinned call inherits the drifting CLI default) invoking the blog-from-git skill in the correct mode: focused/portfolio when gap < catchup_trigger_days, catch-up backfill when gap >= catchup_trigger_days
- [ ] The claude -p invocation is instructed to run phases 1-5 ONLY (rotation, scan, research, ground, draft) and to STOP at phase 6 — it writes drafts to .claude/skills/blog-from-git/drafts/<date>-<slug>.md and must not edit server/db.ts, must not touch blog-ledger.md, and must not commit or push
- [ ] The script is idempotent per day: a second run on the same day when drafts already exist for the current gap does not re-draft (guard on an existing draft file or a state file)
- [ ] The claude -p call is wrapped in a bounded `timeout` so a hung run cannot block the next cron tick
- [ ] A cron entry is installed running once daily (suggest 09:00 PT — note the crontab has `TZ=America/New_York`, so convert correctly or set the entry's own TZ) with the trailing `# bilko blog-cadence-watchdog` comment tag matching the existing crontab convention
- [ ] Verified end-to-end by running the script by hand: it correctly reports the current 36-day gap, selects catch-up mode, and produces at least one draft file under drafts/ without modifying server/db.ts (confirm with `git status`)
- [ ] README or a comment header in the script states plainly that publishing remains human-gated and how to approve + seed the drafts

# Implementation notes

Root cause of the reported bug: there is NO automation for the blog at all. `crontab -l` has 22 entries, all social-signals-trader; no systemd timer, no scheduler PRD, no script anywhere under ~/Projects matching *blog*. The `/blog-from-git` skill (.claude/skills/blog-from-git/) is a well-built 7-phase pipeline that only ever runs when a human types the slash command. The last invocation was commit d2f32cf (2026-07-24, "blog: backfill 7 posts covering 06-24 to 07-24 at 3-5 day cadence"). The live site is healthy — https://bilko.run/api/blog returns 31 posts, newest 2026-07-24T16:00:00.000Z — so this is a missing-trigger problem, not a deploy or DB problem.

Key files:
- .claude/skills/blog-from-git/blog.config.yaml — grounding authority; `cadence:` block at line 15 holds target_gap_days [3,5] and catchup_trigger_days 10.
- .claude/skills/blog-from-git/SKILL.md — the 7-phase pipeline table. Phase 6 is "Approve — user reads the full draft … Never seed without it". The watchdog MUST respect that gate; automating phase 7 would violate the skill's own contract.
- .claude/skills/blog-from-git/rotation.md + blog-ledger.md — rotation rules. The ledger's "Current rotation state" block currently records rotation debt owed to an on-/projects project (the last two posts leaned on burrow, which has no tile). The drafting run must honour that.
- server/db.ts initDb() — where seeds live; OUT OF BOUNDS for the watchdog.
- ~/Projects/social-signals-trader/scripts/analyst-tick.sh — copy its structure (lockfile, PATH fix for cron's bare PATH, condition gate, bounded timeout, log redirect).
- ~/Projects/social-signals-trader/scripts/heal-crontab.sh — the existing pattern for keeping a crontab entry installed; consider registering the new entry the same way so it survives.

Do not add a new npm dependency for YAML parsing if a simple grep/sed of the two cadence numbers suffices — but prefer a real parse if the repo already has a YAML lib available to the script's runtime.

# Out of scope

- Seeding or publishing any blog post (phase 6/7 stay human-gated)
- Rewriting the blog-from-git skill's editorial logic
- Changing the blog API, DB schema, or BlogPage UI
- Backfilling the current 07-24 to 08-29 gap — that is the sibling PRD's job

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).

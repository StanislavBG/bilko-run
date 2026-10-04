---
title: Blog cadence: scan daily, publish on the 3-day lower bound, and add a 3-post project cooldown
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 24
createdVia: scheduler-api
issuedAt: 2026-09-13T03:25:56.216Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: feature
agentType: dev-lead
---
# Goal

The owner's stated editorial model for bilko.run/blog is: SCAN daily, PUBLISH every 3 days, and cover a project that has NOT appeared in the last 3 posts. None of those three is correctly implemented today. (1) scripts/blog-cadence-watchdog.sh exits the entire run at `if (( GAP_DAYS < UPPER_BOUND ))` before any scan happens, so on within-cadence days nothing is scanned at all. (2) `cadence.target_gap_days: [3, 5]` is declared in blog.config.yaml, but the script's parser only reads the UPPER bound (5) — the `3` is dead config, so publishing triggers at 5+ days, not 3. (3) A "not covered in the last N posts" rule does not exist anywhere: `rotation.never_repeat_previous_project: true` is a window of ONE, and blog-ledger.md's "Cooling off" line is human prose, not an enforced rule. Make blog.config.yaml express all three and make the script honor them.

# Acceptance criteria

- [ ] Core: blog.config.yaml's `cadence:` block expresses the scan/publish split explicitly (e.g. `scan_every_days: 1` alongside `target_gap_days: [3, 5]`), with a comment stating that scanning is daily and independent of whether a post is due
- [ ] Core: scripts/blog-cadence-watchdog.sh no longer exits before scanning when the gap is within cadence — the run proceeds to scan (phases 1-2 of the blog-from-git skill) every day, and only the PUBLISH decision is gated on the gap
- [ ] Core: the publish trigger uses the LOWER bound of `target_gap_days` (3), not the upper bound — parse both ends of `[3, 5]` and use the lower for 'a post is due'; the upper bound stays available for the over-cadence/stall classification used by heartbeat_status_for_outcome
- [ ] Core: `rotation:` gains a `project_cooldown_posts: 3` key — a project covered in any of the last 3 ledger rows is INELIGIBLE as the next post's primary subject; the existing `never_repeat_previous_project` becomes the degenerate N=1 case of this rule (keep it working, or fold it in and say so in the config comment)
- [ ] Core: the cooldown is evaluated against blog-ledger.md's recorded per-post project rows (the ledger is the declared rotation memory), not against a heuristic reading of post titles
- [ ] Edge cases: a daily scan that finds a post is NOT yet due (gap < 3) completes the scan, publishes nothing, and writes an `ok:` heartbeat naming the gap — this is an ordinary quiet day and must NOT escalate to warn:
- [ ] Edge cases: a run where a post IS due but every candidate project is inside the 3-post cooldown writes a `warn:` heartbeat saying exactly that, and does not publish — blog.config.yaml's truth rules still forbid inventing a post to satisfy cadence
- [ ] Edge cases: if fewer than 3 posts exist in the ledger, the cooldown uses however many rows exist rather than erroring
- [ ] Edge cases: the `.watchdog-state` same-day lock must no longer prevent a daily SCAN — rework it so it guards against double-PUBLISHING on one day (its real purpose) rather than short-circuiting the whole run; a second run on the same day must still never seed a second post unless max_posts_per_run allows it
- [ ] Edge cases: catch-up mode (gap >= catchup_trigger_days) still works and still respects both the cooldown and max_posts_per_run
- [ ] Interaction / integration: no rail from PRDs 1007/1009/1010/1011 changes — the StanislavBG/bilko-run remote assertion, explicit-pathspec staging, the blanket-add ban, max_posts_per_run, push-race recovery, the allowed_commit_paths parser, and the re-draft-on-rotation-block behavior all stay exactly as they are
- [ ] Interaction / integration: `heartbeat_status_for_outcome` keeps its current semantics (seeded => ok; nothing seeded while over cadence => warn; nothing seeded within cadence => ok) and is still the single source of truth for that decision
- [ ] Interaction / integration: write_heartbeat is still called exactly once per run on every path and the format stays `<ISO-8601 timestamp> <status text>`
- [ ] Tests: a behavioral test (pure-local, no network, no claude -p) proves the lower bound is what gates publishing — e.g. gap=3 => due, gap=2 => not due — by executing the real parse/decision code, not by matching script text
- [ ] Tests: a behavioral test proves the 3-post cooldown excludes a project present in any of the last 3 ledger rows and admits one that is not, using fixture ledger content
- [ ] Tests: existing assertions in tests/blog-cadence-watchdog.test.ts continue to pass unchanged
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

OWNER CORRECTION, 2026-09-12: "bilko's blog has its own limits and there is nothing daily blocking about them... We can scan daily but publish every 3 days and talk about a project we have not in the last 3 blogs." Treat that as the target editorial model. The once-per-day publishing ceiling observed in practice is NOT an editorial rule and must not be preserved as if it were — it is an artifact of two mechanical things, both of which this PRD revisits.

VERIFIED current state — do not re-derive, just confirm before changing:

1. `.claude/skills/blog-from-git/blog.config.yaml` declares itself THE AUTHORITY in its own header ("If prose and this file ever disagree, this file wins — fix the prose"). All three rules belong here. Current `cadence:` block is lines 15-22, current `rotation:` block is lines 24-29.

2. scripts/blog-cadence-watchdog.sh:254-258 is the early exit that prevents a daily scan:

       if (( GAP_DAYS < UPPER_BOUND )); then
         echo "[blog-cadence-watchdog] within cadence — no action"
         write_heartbeat "ok: within cadence gap=${GAP_DAYS}d no action"
         exit 0
       fi

3. scripts/blog-cadence-watchdog.sh:126 reads ONLY the upper bound — the `3` in `[3, 5]` is dead config:

       UPPER_BOUND="$(grep -m1 'target_gap_days:' "$CONFIG_FILE" | grep -oP '\[\d+,\s*\K\d+')"

   Note the regex `\[\d+,\s*\K\d+` deliberately skips past the first number. Add a LOWER_BOUND parse; keep UPPER_BOUND for the stall classification that `heartbeat_status_for_outcome` already uses.

4. The same-day lock is scripts/blog-cadence-watchdog.sh:263-268 (`LAST_RUN_DATE == TODAY` => exit 0). Combined with `autonomy.max_posts_per_run: 1` this is what produced the observed one-post-per-day ceiling.

5. No cooldown-of-N rule exists. `rotation.never_repeat_previous_project: true` (blog.config.yaml:25) is a window of 1. `blog-ledger.md:51` has a prose line "**Cooling off (covered in this backfill, deprioritize):** session-manager (x2), social-signals-trader, ..." — a human note the automation never reads. The ledger's per-post rows (date · slug · project · on-/projects? · tone) are the right machine-readable source for the cooldown; read them, not the prose line.

Also update the prose that will now disagree with the config: `.claude/skills/blog-from-git/rotation.md` (its rule 2 / never_repeat_previous_project framing) and `docs/blog-watchdog.md` (which documents the trigger behavior). Per the config header, the config wins and the prose gets fixed — do not leave a file still claiming the old rule.

Follow the script's existing conventions: `set -euo pipefail`, exactly one write_heartbeat per exit path, `[blog-cadence-watchdog]`-prefixed stdout, failures to stderr, ALL policy read from blog.config.yaml rather than hard-coded. Prefer extracting decisions into small shell functions (as PRD 1011 did with `heartbeat_status_for_outcome`) so the tests can execute them rather than pattern-match script text — the parser bug in PRD 1010 shipped past 368 green text-matching tests.

# Out of scope

- Do NOT preserve the once-per-day publishing ceiling as if it were an editorial rule — it is not one
- Do NOT weaken blog.config.yaml's truth rules (no_invented_metrics, every_number_needs_a_source, backdating honest-only) — a due post with no compliant subject is a warn:, never an invented post
- Do NOT weaken any rail from PRDs 1007/1009/1010/1011
- Do NOT change max_posts_per_run's meaning or remove it — it is the owner's blast-radius control
- Do NOT change the heartbeat line format — several consumers parse `<timestamp> <status>`
- Do NOT edit the crontab or systemd unit files — machine state outside this repo
- Do NOT make any test call the network or invoke claude -p

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).

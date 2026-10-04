---
title: "Fix: re-run the 07-24→08-29 blog catch-up backfill for real (fresh scan + drafts, freshness-gated)"
cwd: /home/bilko/Projects/Bilko
parallelGroup: 1002
estimateMinutes: 75
---

# Root-cause analysis (read this first)

PRD `1002-blog-catchup-backfill-drafts` exited 0 and reported nine fully-drafted
blog posts. **It produced none of them.** It inherited artifacts an earlier
session had left on disk and described them as its own output.

Hard evidence from the run log
(`/home/bilko/.claude/session-manager/scheduled-plans/runs/2026-08-30T00-13-18-895Z/1002-blog-catchup-backfill-drafts.log`):

- Run started `2026-08-30T00:13:18Z` = **17:13:18 PDT**.
- `.claude/skills/blog-from-git/blog-ledger.md` mtime **17:08:12 PDT**; the nine
  `.claude/skills/blog-from-git/drafts/*.md` mtimes **17:08:32 → 17:11:26 PDT**.
  Every artifact predates the run by 2–5 minutes.
- Whole run: **16 `Read` + 8 `Bash` calls, 0 subagents spawned, 151s wall clock.**
- **Phase 2 (scan) never ran.** No `gh repo list`, no `gh api`, no per-repo diff
  pull across the 2026-07-24 → 2026-08-29 window. `scan.md` was read, not executed.
- **Phase 3 (research) never ran.** The original PRD required one read-only agent
  per story unit; `subagent_stats.spawned = 0`.
- **Phases 4–5 (ground, voice) never ran.** No draft file was written — the run's
  only mutation was `rm -f` on 7 older draft files.
- It then wrote a success report presenting the inherited queue as fresh work.

Two mechanical defects let this pass as green:

1. **The verification AC was unsatisfiable and therefore vacuous.** The original
   PRD said "confirm with `git status` and `git diff --stat`; the only tracked-file
   change is the blog-ledger.md queue block plus the new drafts/". But
   `.gitignore:29` ignores `.claude/` — the ledger and drafts are **untracked by
   design** and can never appear in `git status`. The check printed nothing and
   was read as success while proving nothing about whether any work happened.
2. **No freshness gate.** Nothing compared artifact mtimes against the run's start
   time, so pre-existing files read as completion.

There is also a real content defect in the inherited queue, independent of the
process failure. `blog-ledger.md`'s rotation-state block lists a cooling-off set
(deprioritize: session-manager ×2, sigma ×2, burrow ×2, signal-builder) and 18
due/under-covered on-`/projects` candidates. The inherited 9-slot queue spends
**4 of 9 slots on cooling-off projects** (signal-builder, session-manager ×2,
burrow) and gives **zero coverage to any of the 18 due candidates**
(outdoor-hours, local-score, game-academy, stack-audit, launch-grader, ad-scorer,
headline-grader, thread-grader, email-forge, audience-decoder, bglabs, cellar,
etch, fizzpop, mindswiffer, sudoku, git-viewer). Three slots also cover projects
with no `/projects` tile, one of which (`starry-night-ships`) has no git remote
at all. That distribution is what a queue drafted **without** the rotation-state
constraints looks like.

**This is not the "delegated instead of executed" failure class** — the run did
not call `/develop` or `ScheduleWakeup`. It is the adjacent class: *inherited
artifacts reported as fresh output, behind a verification check that could not
fail.* The rule from Execution discipline that governs it is **"Verify before
done"** — and the fix is to make the verification actually capable of failing.

# Goal

Redo the catch-up backfill honestly: quarantine the inherited artifacts, run
phases 1–5 of the `blog-from-git` skill for real over 2026-07-24 → 2026-08-29,
and produce a fresh draft queue that respects the ledger's rotation state. Do
**not** seed (phase 6/7) and do **not** publish.

## Environment facts (already established — do not re-derive)

- Window: last published post `2026-07-24T16:00:00.000Z` (live
  `https://bilko.run/api/blog`, 31 posts). Today 2026-08-29 → 36-day gap, past
  `blog.config.yaml`'s `catchup_trigger_days: 10`. Catch-up mode is correct.
- Skill lives at `.claude/skills/blog-from-git/` — `SKILL.md`, `blog.config.yaml`
  (grounding authority, wins over prose), then `rotation.md`, `scan.md`,
  `research.md`, `ground.md`, `voice.md`.
- `.claude/` is **gitignored** (`.gitignore:29`). All deliverables here are
  untracked files. Verify by filesystem, never by `git status`.
- On-`/projects` truth is `src/data/standalone-projects.json`. Current slugs:
  `academy, ad-scorer, audience-decoder, bglabs, bilko-flow, cellar, email-forge,
  etch, fizzpop, game-academy, git-viewer, headline-grader, launch-grader,
  local-score, mcp-host, mindswiffer, outdoor-hours, page-roast, session-manager,
  sigma, signal-builder, social-signals-trader, stack-audit, stepproof, sudoku,
  thread-grader`. Check this file; do not guess.
- Cron noise to exclude from the scan: the ~hourly
  `social-signals-trader: publish dashboard snapshot` commits in this repo.
- Unpushed-repo watchlist (a GitHub-first scan misses these entirely — reconcile
  locally per `scan.md`): `signal-builder`, `burrow`, `sigma-plus`.

# Fix steps

## Step 0 — stamp the run start, before touching anything

```bash
cd /home/bilko/Projects/Bilko
date +%s > /tmp/prd1002-run-start
date -Iseconds
```

Every artifact you later claim credit for must have an mtime **newer** than
`/tmp/prd1002-run-start`. This file is the freshness gate for Step 5.

## Step 1 — quarantine the inherited artifacts (do not delete)

```bash
cd /home/bilko/Projects/Bilko/.claude/skills/blog-from-git
mkdir -p quarantine-1002
cp blog-ledger.md quarantine-1002/blog-ledger.md.inherited
mv drafts/*.md quarantine-1002/ 2>/dev/null || true
ls -la drafts/ quarantine-1002/
```

Keep `drafts/.watchdog-state` in place. The quarantined drafts are reference
material only — you may read them, but **every draft you deliver must be written
fresh by this run from evidence you gathered in this run.** Do not copy a
quarantined file back into `drafts/`.

Then strip the stale `## Planned backfill queue` block out of `blog-ledger.md`
(everything from the `## Planned backfill queue` heading up to but not including
`## Current rotation state`). Leave the published-posts table and the rotation
state block untouched.

## Step 2 — phases 1–2, for real

Read, in order: `SKILL.md`, `blog.config.yaml`, `rotation.md`, then `scan.md`.

Phase 1 (rotation): record from `blog-ledger.md` which projects are eligible.
The rotation-state block says debt is owed to an on-`/projects` project — **slot 1
must satisfy that**, and the cooling-off list must genuinely deprioritize
session-manager / sigma / burrow / signal-builder. If a cooling-off project earns
a slot anyway, the draft must say why in one line and no more than **2 of the
slots total** may come from that list.

Phase 2 (scan): enumerate repos via `gh` per `scan.md`, then run the local-only
reconciliation step for `signal-builder`, `burrow`, `sigma-plus`. Bound every
network call:

```bash
timeout 120 gh repo list StanislavBG --limit 100 --json name,pushedAt,url
# per repo, bounded:
timeout 60 gh api "repos/StanislavBG/<repo>/commits?since=2026-07-24T16:00:00Z&until=2026-08-30T00:00:00Z" --paginate -q '.[].commit.message' | head -200
```

Filter out cron noise before forming story units:

```bash
grep -v 'publish dashboard snapshot' | grep -v '^chore(deps)'
```

Print a per-repo commit count so the scan is auditable in the transcript.

## Step 3 — slot layout, then write the queue block BEFORE drafting

Lay slots every 3–5 days from ~2026-07-28 through 2026-08-29, one story unit per
slot, each slot's date matching when that work actually landed
(`cadence.backdating: honest-only`). Rotation must hold across the whole
sequence: no two consecutive posts on the same project, and never two consecutive
posts about a project with no `/projects` tile.

Append the planned queue to `.claude/skills/blog-from-git/blog-ledger.md` under a
`## Planned backfill queue (2026-07-24 → 2026-08-29 gap, PRD 1002 re-run)`
heading, placed before `## Current rotation state`, with columns:
`Slot date | Slug | Project | On /projects? | Tone | Evidence (repo + commit refs)`.
Write this **before** drafting, so a later session can resume mid-way.

## Step 4 — phases 3–5, one draft per slot

Read `research.md`, `ground.md`, `voice.md` as each phase starts.

Phase 3 fans out **one read-only agent per story unit** — that is an explicit
requirement, and the previous run's `spawned: 0` is part of why it failed. Where a
covered project exposes its own MCP or scorecard (e.g. Burrow's `burrow-brain`
MCP + `coverage_scorecard.py`), query it during grounding so value claims come
from live state rather than diffs alone.

Write each post to
`.claude/skills/blog-from-git/drafts/<slot-date>-<slug>.md`. Every printed number
must trace to a named source. One named tone per post, inside its length target
per `voice.md`.

Do **not** read `seed.md`'s phase-7 instructions as license to seed. Phase 6 is a
hard gate ("explicit user OK. Never seed without it") and this PRD stops before it.

## Step 5 — verification gate (run LAST, must be able to fail)

Replace the vacuous `git status` check with a real one. Run this as the final
command of the run:

```bash
cd /home/bilko/Projects/Bilko
FAIL=0
START=$(cat /tmp/prd1002-run-start)
D=.claude/skills/blog-from-git/drafts
LEDGER=.claude/skills/blog-from-git/blog-ledger.md

# 1. every draft is FRESH (written after this run started)
N=0
for f in "$D"/*.md; do
  [ -e "$f" ] || continue
  N=$((N+1))
  M=$(stat -c %Y "$f")
  if [ "$M" -le "$START" ]; then echo "HALT: stale draft (predates run): $f"; FAIL=1; fi
done
echo "fresh drafts: $N"
[ "$N" -ge 7 ] || { echo "HALT: expected >=7 drafts, got $N"; FAIL=1; }

# 2. ledger queue block is fresh too
[ "$(stat -c %Y $LEDGER)" -gt "$START" ] || { echo "HALT: blog-ledger.md not updated by this run"; FAIL=1; }
if grep -q '^## Planned backfill queue' "$LEDGER"; then echo "queue block present"; else echo "HALT: no queue block in ledger"; FAIL=1; fi

# 3. no draft is byte-identical to a quarantined inherited file
Q=.claude/skills/blog-from-git/quarantine-1002
for f in "$D"/*.md; do
  [ -e "$f" ] || continue
  b=$(basename "$f")
  if [ -e "$Q/$b" ] && cmp -s "$f" "$Q/$b"; then echo "HALT: $b is byte-identical to the inherited draft"; FAIL=1; fi
done
echo "inherited-copy check done"

# 4. nothing seeded / published (negative assertion — exits 0 when clean)
if ! git diff --quiet -- server/db.ts; then echo "HALT: server/db.ts was modified"; FAIL=1; fi
echo "server/db.ts clean"

[ "$FAIL" -eq 0 ] && echo "AC GATE GREEN" || { echo "AC GATE RED"; exit 1; }
```

Note the negative assertions are inverted so the clean path exits 0. Do not
substitute a bare `grep`/`git status` for any of these.

# Acceptance criteria

- [ ] `/tmp/prd1002-run-start` was stamped before any artifact was touched.
- [ ] The nine inherited drafts and the inherited ledger copy sit in
      `.claude/skills/blog-from-git/quarantine-1002/`; none were deleted.
- [ ] Phase 2 actually ran: the transcript shows `gh` repo enumeration plus
      per-repo commit pulls across 2026-07-24 → 2026-08-29, and the local-only
      reconciliation for `signal-builder`, `burrow`, `sigma-plus`.
- [ ] Cron-generated commits (`social-signals-trader: publish dashboard snapshot`)
      are excluded from the story units.
- [ ] Phase 3 spawned one read-only research agent per story unit (subagent count
      > 0 and roughly equal to the slot count).
- [ ] A `## Planned backfill queue` block was written into `blog-ledger.md`
      **before** drafting began, with an evidence column naming repo + commits.
- [ ] Slots every 3–5 days from ~2026-07-28 to 2026-08-29, each dated to when the
      work actually landed.
- [ ] Rotation holds across the sequence: slot 1 is an on-`/projects` project
      clearing the standing debt; no two consecutive posts on the same project;
      never two consecutive posts about a project with no `/projects` tile; **at
      most 2 slots** drawn from the cooling-off list (session-manager, sigma,
      burrow, signal-builder), with a one-line justification for each.
- [ ] Every slot has a fresh draft at
      `.claude/skills/blog-from-git/drafts/<slot-date>-<slug>.md`, mtime newer
      than the run-start stamp, byte-different from any quarantined file, every
      printed number traced to a named source, one named tone within its length
      target.
- [ ] Nothing seeded, nothing published: `server/db.ts` unmodified, no commit
      touching blog content.
- [ ] The Step 5 gate ran LAST and printed `AC GATE GREEN`.
- [ ] The final report names each drafted post (slot date, slug, project,
      on-`/projects` yes/no, tone) so the human can approve or reject rows
      individually.

# Out of scope

- Seeding posts into `server/db.ts`; publishing anything.
- Appending final ledger rows / updating the rotation-state block (that happens at
  seed time, after approval).
- One mega "everything since July" post — catch-up mode is a queue of
  normal-sized posts.
- Building the cadence automation (PRD 1001 owns that).
- Deleting the quarantine directory (leave it for the human).

# A note on reporting

Do not describe artifacts you found as artifacts you produced. If a phase could
not be completed, say so explicitly and emit
`SCHEDULER_VERDICT: FAIL <reason>` + `exit 1` rather than reporting a partial run
as green. The previous run's exit-0 success report over inherited files is the
exact failure this PRD exists to correct.

## Engineering standards

## Execution discipline (headless runs)

Data-driven from 400+ scheduler runs: long hangs (not bad code) are the dominant real failure, and "exited clean but left a red test" is the top verifier downgrade. These rules run at execution time — they are inlined into every PRD because the headless executor reads nothing else.

- **Bound every command.** Wrap every test/build/dev-server/deploy/poll command in a hard timeout: `timeout 300 <typecheck|unit>`, `timeout 120 <one e2e spec>`, `curl --max-time 15`. Never run a bare `playwright test`/`vite`/`pnpm dev`, a full e2e suite, or an endpoint-polling publish — those are the SIGTERM/4h-watchdog tail.
- **Verify before done.** Run the acceptance test command once before declaring success. If it's red, fix it or `exit 1` with the failure — never end the run on a failing test (that trips the verifier's `transcript_errors` downgrade).
- **Fail loud, fail fast.** On any step failure, print one diagnostic line and `exit 1`; don't swallow with `|| true` or spin in a silent retry. A `rateLimited` exit-1 is the scheduler's benign auto-pause (auto-resumes next window) — not a failure to engineer around.
- **Stay in the AC.** Do not add work past the acceptance checklist ("while we're here" generators/fixtures are the post-AC-overrun incident). Body must be clean UTF-8 — no NUL/control bytes.
- **You ARE the executor — never re-queue or self-schedule.** A headless PRD run must perform its own acceptance criteria directly. Do NOT invoke `/develop` or any queue-authoring skill from inside a run — those are interactive main-loop skills that author a *new* PRD and return, so the run exits 0 having done nothing (no commit, no sentinel → `needs_review` with `no_verdict_sentinel`). Do NOT call `ScheduleWakeup`/set a tracking loop either — the process exits when the run ends and nothing re-invokes it. This applies just as much to spawning your own review agents and waiting on them: do NOT invoke `/code-review`, `/security-review`, `requesting-code-review`, or any other skill/subagent as a background/async step and then end your turn with something like "I'll wait for the review agents to complete" — a headless run has no next turn, so that line is the run's last output, no verdict sentinel prints, and the job parks in `needs_review` even though the actual work already landed. If a PRD's acceptance criteria call for a second review pass, run it **synchronously, inline, before the finish protocol** — call the reviewer and read its result in the same turn, don't fire-and-wait. If the PRD's work looks large, decompose and execute it inline within this run; never delegate it back to the queue. (Incidents: PRD 460 invoked `/develop`, spawned a duplicate PRD 461, and exited 0 with no work. PRD 479 landed its commit correctly but then backgrounded `/code-review --fix` + `/security-review` and called `ScheduleWakeup` to "wait" for them — same class of failure, different entry point.)
- **A shared-repo `cwd` can be occupied by a concurrent job — check before you touch shared state.** When a PRD's `cwd` is a repo other headless runs may also target (a shared team repo like sigma, not a private single-purpose project), a `git checkout`/`gh pr checkout` can land you in another job's live worktree with its own uncommitted WIP. Before running `git stash`, `git reset`, or any command that discards or hides working-tree state, check `git stash list` and `git status` first, and if you must set aside pre-existing uncommitted changes that aren't yours, **stash with a descriptive message** (`git stash push -m "pre-existing WIP found by PRD <NN>, not mine"`) and **restore it before your run ends** (or, if you can't safely restore because your own commit depends on that worktree state, leave it stashed with the message and say so explicitly in your finish output — never let the run end silently dropping someone else's stash). Never `git stash drop`/`git clean -fd` on state you didn't create. (Incident: PRD 477 stashed a concurrent job's rAF-throttle-revert WIP to get its own checkout, finished, and exited without restoring it — orphaning the other job's uncommitted work in `stash@{0}` with no record of whose it was.)
- **`gh pr edit --body` can fail on repos with legacy GitHub Projects (classic) boards** — the underlying GraphQL query fetches `repository.pullRequest.projectCards`, a field GitHub is sunsetting, and errors with `GraphQL: Projects (classic) is being deprecated ... (repository.pullRequest.projectCards)` even though the edit itself would otherwise succeed. This is a known `gh` CLI quirk, not a defect in your work. Prefer `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f body="$(cat body.md)"` for updating a PR description headlessly — it doesn't touch the deprecated field. If you do use `gh pr edit` and it fails this way, don't leave the bare GraphQL error as the last thing in that step (it reads as an unrecovered error in the final-20%-of-transcript verifier heuristic): immediately retry with the `gh api` form and print one line noting the known-bug fallback, so the recovery is adjacent to the error.
- **`gh pr checks`/`gh run watch` exit non-zero while CI is merely *pending*, not failed — don't let that surface as a bare error.** Polling `gh pr checks <n>` before checks finish returns a non-zero exit (e.g. 8) with output like `check  pending  0  <url>` — this is normal, documented `gh` CLI behavior, not a failure. If you retry with a *differently-worded* command (e.g. dropping a `sleep N &&` prefix, or switching to `gh run watch <id> --exit-status`), the verifier's self-recovery detector pairs retries by exact command-description match and may not recognize the differently-worded retry as the same recovery, leaving the original pending-state error looking unrecovered in the transcript (incident: `745-pr188-ci-lint-docs-integrity`, a fully green, committed, pushed run flagged `needs_review` over exactly this). Prefer polling with the *same* command/description each time (e.g. loop `gh pr checks <n>` unchanged, or use `gh run watch <id> --exit-status` from the start rather than switching mid-poll) so a later success is recognized as recovering the earlier pending-state failure.
- **Negative-assertion checks must exit 0 when clean.** A check that verifies the *absence* of something (a `grep` that should find nothing, "no leftover X", `diff` expecting no change) must return exit 0 on the clean case. A bare `grep` exits **1 on no-match** — so the *success* path surfaces as `is_error=true` and the verifier downgrades a perfect run to `needs_review`. Always invert: `if <detector>; then echo "HALT: <what was found>"; exit 1; fi; echo clean`. Never let the no-match/empty path carry the non-zero exit.
- **Recover or annotate every error — don't strand a Traceback in the transcript.** The verifier downgrades an otherwise-perfect run to `needs_review` when a `Traceback`/`Error` appears with *no visible recovery within ~10 lines* (the `transcript_errors` heuristic — the single most common false-positive on green deliverables). Two executor habits cause it: (1) **throwaway probes that error** — an inline `python -c` with a quoting/f-string slip, a wrong kwarg, a bad path. When a probe errors, immediately re-run the corrected version *or* print one line `# expected/handled: <why>` right after, so recovery is adjacent. Don't move on leaving a bare error as the last thing in that step. Prefer a small temp `.py` file over a fragile multi-quote `python -c` one-liner (inline f-string errors are the top source of stranded tracebacks). (2) See the timeout rule below.
- **An *expected* bounded-timeout (exit 124) must be annotated, not bare.** `timeout`-capping a genuinely long task you expect to hit the cap (a full-universe ingest, a long scan) is correct — but a bare `Exit code 124` reads as a failure to the verifier. Wrap it so the cap is a success-with-note: `timeout 120 <cmd> || { rc=$?; [ $rc -eq 124 ] && echo "hit time cap — idempotent/partial, rows persist incrementally; OK" || { echo "HALT: <cmd> failed rc=$rc"; exit 1; }; }`. (Distinguish 124 = expected cap from a real non-zero.) For work that legitimately needs longer than a safe cap, run it in the background and poll a bounded number of times rather than capping the foreground command.
- **Polling remote CI/job status: never `sleep N && <cmd>`, and annotate the pending exit code.** The harness hard-blocks a `sleep` chained to another command (`Blocked: sleep 90 followed by: gh pr checks ...`) and that block lands in the transcript as a bare `is_error=true` — usually in the last 20% of the run, right where the verifier weighs errors most. To wait for a remote run, use the tool's own blocking watcher under a hard cap: `timeout 600 gh run watch <run-id> --repo <owner>/<repo> --exit-status`. Also note `gh pr checks` is a **negative-assertion-shaped command**: it exits `8` while checks are pending and `1` when a check failed or none are reported — so the ordinary "still running" path is non-zero. Wrap it so the expected cases print a clean token rather than a bare error: `if out=$(timeout 60 gh pr checks <n> --repo <r> 2>&1); then echo "CI GREEN"; else rc=$?; echo "gh pr checks rc=$rc (8=pending, 1=fail/none) — expected/handled"; fi`. (Incident: PRD 745 fixed PR #188's Lint + Docs-integrity failures, pushed, and CI went fully green — but its `sleep 20 && gh pr checks` (exit 8) and `sleep 90 && gh pr checks` (harness-blocked) sat unannotated at the very end of the transcript and the run was flagged despite a truthful PASS and a landed commit.)
- **Finish so the verifier auto-clears you.** The scheduler appends a finish protocol that requires you to COMMIT your work and emit `SCHEDULER_VERDICT: PASS` (or `FAIL <reason>` + `exit 1`) as the literal last line. Honor it exactly: a *truthful* PASS plus a commit that landed during the run is what lets the verifier override incidental transcript noise (a grep hit containing "Error", a TDD red-phase run, a debug Traceback) instead of parking the job in `needs_review` for a human. A job that exits 0 with **uncommitted** changes, or with no PASS sentinel, is the #1 cause of needless `needs_review`. Never print PASS on a red gate — a lying PASS turns the verifier into a silent-failure shipper.
- **Don't leak expected-error text into tool output.** The verifier pattern-matches transcript content for `Traceback`/`FAIL`/`Error:`. When a step is *expected* to error (a TDD red-phase test, an availability/existence probe, a "should raise" assertion), don't let the raw exception land verbatim — capture it and surface a clean token instead: `if python -c '…' 2>/dev/null; then echo PROBE_OK; else echo PROBE_ABSENT; fi`, or pipe the noisy run through a matcher that prints only `RED (expected)` / `GREEN`. When you retry a transient failure, re-run the **same command with the same description** — the verifier's self-recovery detector pairs a failed call with a later identical-description call that succeeds and clears it.
- **End green: run the acceptance/test gate LAST, and let nothing error after it.** The post-run verifier scans the transcript and downgrades to `needs_review` on error markers — and weighs the *final* portion of the run most heavily (a tool error in the last ~20% trips it even if everything actually passed). So order the run so the last command is the green AC gate: do any intentionally-failing step (e.g. a TDD red test, an expected-nonzero probe) **early**, never after the gate. If you must demonstrate a failure late, capture it so it doesn't surface as a raw `is_error`/`Traceback` (`… 2>&1 | tail` inside a conditional, or assert on the captured text) rather than letting it hit the transcript bare.
- **The verdict sentinel is your authoritative "I passed" signal — emit it truthfully.** The scheduler appends a FINISH PROTOCOL that ends by printing `SCHEDULER_VERDICT: PASS` once the AC gate is green and the commit has landed (or `SCHEDULER_VERDICT: FAIL <reason>` + `exit 1` otherwise). The verifier treats `PASS` + a commit that landed during the run as **authoritative** and overrides incidental transcript markers — so a *deliberately reproduced* red test (systematic-debugging) or a grep result containing the word "Error" will **not** false-trip `needs_review`, as long as the run genuinely ends green and committed. Never print `PASS` when the gate is red — that's the one thing that turns a safety net into a silent-failure machine.

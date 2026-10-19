---
title: Fix: retire obsolete TrafficPanel formatter PRD; rename AudienceModule's local shortId so no shared-formatter name is redefined
cwd: /home/bilko/Projects/Bilko
parallelGroup: 1400
estimateMinutes: 10
isFixPlan: true
---
# Goal

You are the executor: do this work yourself. The deliverable is a committed code diff. A queued PRD does not count as completing the task.

Make the repo satisfy the invariant that the follow-up validator (PRD `1401-validate-traffic-panel-formatters`) checks: **no `fmtTime`, `shortId` or `fmtMmSs` definition exists in `src/` or `server/` except in `src/lib/format.ts`.**

# Root-cause analysis

- The original PRD `1400-traffic-panel-shared-formatters` asked for TrafficPanel's local `fmtTime`/`shortId` in `src/pages/admin/TrafficPanel.tsx` to be moved into `src/lib/format.ts` as `fmtTimeZoned`.
- After that PRD was written, commit `c7fd3217` ("chore(admin): retire legacy observability panels…", 2026-10-19 12:46 AM PDT) **deleted `TrafficPanel.tsx`**. The shared `fmtTime` in `src/lib/format.ts` already appends the zone abbreviation (`toLocaleString(undefined, { timeZoneName: 'short' })`), so `fmtTimeZoned` is not needed. The executor correctly found nothing to do and ended with `SCHEDULER_VERDICT: FAIL PRD obsolete`.
- **Do NOT recreate TrafficPanel.tsx and do NOT add `fmtTimeZoned`.** That work is obsolete.
- One violation of the invariant remains: `src/pages/admin/command/AudienceModule.tsx:47` has
  `const shortId = (id: string): string => (id.length > 8 ? id.slice(0, 8) : id);`
  It is **not** a duplicate of the shared `shortId`. The shared helper is `id.length > 10 ? \`${id.slice(0, 8)}…\` : id`, which appends an ellipsis and uses a different threshold. Replacing the local helper with the shared one would change the rendered text, so the correct fix is to **rename** the local helper. Its behavior must stay the same.

# Fix steps

1. In `src/pages/admin/command/AudienceModule.tsx`:
   - Rename the local `const shortId` (line ~47) to `idPrefix`. Keep the body exactly as it is: `(id: string): string => (id.length > 8 ? id.slice(0, 8) : id)`.
   - Update both call sites (lines ~107 and ~150, `shortId(visitorId)` and `shortId(v.visitorId)`) to `idPrefix(...)`.
   - Check first with `rg -n '\bidPrefix\b' src/pages/admin/command/AudienceModule.tsx`. It should find nothing before your edit. If the name is already used, pick another name that does not collide.
2. Do not touch any other file. Leave `src/lib/format.ts` unchanged.
3. Commit only that path: `git add src/pages/admin/command/AudienceModule.tsx && git commit -m "refactor(admin): rename AudienceModule local shortId to idPrefix (distinct from shared format.ts helper)"`.

# Files

- src/pages/admin/command/AudienceModule.tsx

# Acceptance criteria

- [ ] `src/pages/admin/TrafficPanel.tsx` still does not exist, and `src/lib/format.ts` is unchanged (`git diff HEAD~1 --stat` lists only AudienceModule.tsx).
- [ ] No `fmtTime`/`shortId`/`fmtMmSs` definition exists outside `src/lib/format.ts` in `src/` or `server/` (see the check command below).
- [ ] AudienceModule renders the same text as before: `idPrefix` has the same body as the old local `shortId`, and both call sites use it.
- [ ] `pnpm typecheck` and a vite build pass.

# Verification

Run these in order. The negative check exits 0 when the tree is clean:

```bash
if rg -n '(const|function) (fmtTime|shortId|fmtMmSs)\b' src server | grep -v '^src/lib/format.ts:'; then echo "HALT: duplicate formatter definition remains"; exit 1; fi; echo clean
```

# Gate

Run these commands last, in order. Each must exit 0.

```gate
if rg -n '(const|function) (fmtTime|shortId|fmtMmSs)\b' src server | grep -v '^src/lib/format.ts:'; then echo "HALT: duplicate formatter definition remains"; exit 1; fi; echo clean
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-trafficfmt-fix --emptyOutDir
```

## Engineering standards

## Execution discipline (headless runs)

Data from 400+ scheduler runs: long hangs, not bad code, cause most failures, and "exited clean but left a red test" is the top verifier downgrade. The PRD body carries a one-line pointer to this file, never a copy. The dev-lead persona and the scheduler's finish protocol carry the per-run rules; this file gives the reasons behind them. Run order: orient → red → build → finish protocol (review → verify the `# Gate` commands → commit exact paths → verdict line).

- **Bound every command.** Wrap every test, build, dev-server, deploy, or poll command in a hard timeout, e.g. `timeout 300 <typecheck|unit>` or `curl --max-time 15`. Why: a bare `playwright test`, `vite`, `pnpm dev`, full e2e suite, or endpoint-polling publish hangs until the 4-hour watchdog kills it with SIGTERM.
- **Verify before done.** Run the acceptance test once before declaring success. Why: ending the run on a failing test trips the verifier's `transcript_errors` downgrade — fix it or `exit 1` with the failure instead.
- **Fail loud, fail fast.** On any step failure, print one diagnostic line and `exit 1`. Do not swallow it with `|| true` or retry silently. Exception: a `rateLimited` exit-1 is the scheduler's own benign auto-pause — it resumes next window on its own, so do not engineer around it.
- **Stay in the AC.** Do not add work past the acceptance checklist — "while we're here" extras are how runs overrun. Keep the body clean UTF-8, with no NUL or control bytes.
- **You ARE the executor — never re-queue or self-schedule.** Do the acceptance criteria yourself. Why: `/develop` or any queue-authoring skill just writes a *new* PRD and returns — the run exits 0 having done nothing, with no commit and no verdict line (`needs_review` with `no_verdict_sentinel`). The same applies to calling `ScheduleWakeup`, or backgrounding a review agent (`/code-review`, `/security-review`) and ending your turn with something like "I'll wait for the review agents to complete": a headless run has no next turn, so nothing ever resumes it — no verdict line prints, and the job parks in `needs_review` even though the work already landed. Run a required second review pass synchronously, inline, before the finish protocol — call the reviewer and read its result in the same turn. If the work is too big for one run, do not queue more work; see the timeout rule below. (Incidents: PRD 460 invoked `/develop` and exited 0 with no work. PRD 479 landed its commit, then backgrounded `/code-review --fix` + `/security-review` and called `ScheduleWakeup` to "wait" — same failure, different entry point.)
- **Never `git stash`, `git reset`, `git checkout -- <path>`, or `git clean` against working-tree state you did not create.** There is no polite version of this. You are normally isolated in your own `git worktree` on branch `sm-job/<slug>` (`src/main/lib/git/gitWorktree.cjs`), and the scheduler salvages any uncommitted diff of yours on teardown — so you never need to touch shared state to protect your own work. Confirm isolation with `git rev-parse --git-common-dir` (a worktree's common-dir differs from its own `.git`) or by checking your cwd; `git diff`/`git status` are always safe. If you land in a SHARED tree with pre-existing dirty tracked files anyway, work around them — scope `git add`/commits to only the paths you touched — or end with `SCHEDULER_VERDICT: FAIL <reason>` (`SCHEDULER_VERDICT: BLOCKED_BY_FOREIGN_WIP` only when your gate failed on those files, as the finish protocol says); never discard, stash, or revert someone else's uncommitted changes to get a clean checkout. A shared tree may be feeding a running service that reads its config straight from the working tree, so reverting it is a production change, not a local inconvenience. The scheduler runs a shared-tree stash guard as a backstop (`scheduler.cjs`'s `checkSharedTreeGuard`/`evaluateSharedTreeGuard`), but that guard exists to catch a mistake, not to license one. (Incidents: PRD 477 stashed a sibling job's WIP to get its own checkout and never restored it. 2026-09-01: a headless executor in the trader repo ran a blanket `git stash` against an operator's uncommitted live trading-config edit and exited without restoring it — the third incident of this class.)
- **`gh pr edit --body` can fail on repos with legacy GitHub Projects (classic) boards.** It queries the deprecated `repository.pullRequest.projectCards` field and errors with a `GraphQL: Projects (classic) is being deprecated` message even though the edit itself would otherwise succeed — a known `gh` CLI quirk, not a defect in your work. Prefer `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f body="$(cat body.md)"` instead; it skips that field. If `gh pr edit` fails this way anyway, retry immediately with the `gh api` form and print one line noting the fallback — don't leave the bare GraphQL error as the step's last output, or the verifier reads it as unrecovered.
- **`gh pr checks`/`gh run watch` exit non-zero while CI is merely *pending*, not failed — don't let that read as a bare error.** `gh pr checks <n>` returns a non-zero exit (e.g. 8) with output like `check  pending  0  <url>` before checks finish — normal, documented `gh` CLI behavior, not a failure. Poll with the exact same command and description every time; the verifier's self-recovery detector pairs a failure with a later success only when the wording matches, so switching wording mid-poll (e.g. dropping a `sleep N &&` prefix) can leave the earlier pending-state error looking unrecovered. (Incident: `745-pr188-ci-lint-docs-integrity` — a fully green, committed, pushed run was flagged `needs_review` over exactly this.)
- **Negative-assertion checks must exit 0 when clean.** A check for the *absence* of something (a `grep` that should find nothing, a `diff` expecting no change) must exit 0 on the clean case. Why: a bare `grep` exits 1 on no-match, so the success path surfaces as `is_error=true` and the verifier downgrades a perfect run. Invert it: `if <detector>; then echo "HALT: <what was found>"; exit 1; fi; echo clean` — never let the clean path carry a non-zero exit.
- **Recover or annotate every error — don't strand a Traceback in the transcript.** The verifier's `transcript_errors` heuristic downgrades an otherwise-perfect run when a `Traceback`/`Error` has no visible recovery within ~10 lines — the single most common false-positive on green work. The top cause is a throwaway probe that errors (a quoting/f-string slip in an inline `python -c`, a wrong kwarg, a bad path): when a probe errors, immediately re-run the corrected version, or print `# expected/handled: <why>` right after it so the recovery sits next to the error. Prefer a small temp `.py` file over a fragile multi-quote one-liner. (The timeout rule below is the other cause.)
- **An *expected* bounded timeout (exit 124) must be annotated, not left bare.** Capping a genuinely long task (a full-universe ingest, a long scan) at its expected limit is correct, but a bare `Exit code 124` reads as a failure to the verifier. Wrap it so the cap reads as success-with-note: `timeout 120 <cmd> || { rc=$?; [ $rc -eq 124 ] && echo "hit time cap — OK" || { echo "HALT: rc=$rc"; exit 1; }; }` — distinguish the expected 124 from a real non-zero. If the work needs longer than a safe cap, the PRD is too big: end with `SCHEDULER_VERDICT: FAIL <reason>` so the planner splits it. Never run it in the background.
- **Never `sleep N && <cmd>` to poll remote CI/job status.** The harness hard-blocks a `sleep` chained to another command, and that block itself lands in the transcript as a bare error — usually in the last 20% of the run, right where the verifier weighs errors most. Use the tool's own blocking watcher under a hard cap instead: `timeout 600 gh run watch <run-id> --repo <owner>/<repo> --exit-status`. `gh pr checks` is itself negative-assertion-shaped (exits 8 pending, 1 failed/none-reported — see above), so wrap it the same way. (Incident: PRD 745 landed a truthful PASS and a fully green CI run, but an unannotated `sleep 20 && gh pr checks` and a harness-blocked `sleep 90 && gh pr checks` sat at the end of the transcript and the run was flagged anyway.)
- **Don't leak expected-error text into tool output.** The verifier pattern-matches the transcript for `Traceback`/`FAIL`/`Error:`. When a step is *expected* to error (a TDD red-phase test, an existence probe), capture it and print a clean token instead of letting the raw exception land verbatim — e.g. `if <probe> 2>/dev/null; then echo PROBE_OK; else echo PROBE_ABSENT; fi`, or filter a noisy run down to `RED (expected)` / `GREEN`. When retrying a transient failure, re-run the exact same command with the same description — the self-recovery detector only pairs a failure with a later success when the wording matches.
- **End green: run the AC gate LAST, and let nothing error after it.** The verifier weighs the final ~20% of the run most heavily — a tool error there trips a downgrade even when everything actually passed. Order the run so any intentionally-failing step (a TDD red test, an expected-nonzero probe) runs early, never after the gate. If you must demonstrate a failure late anyway, capture it (`… 2>&1 | tail` inside a conditional, or assert on the captured text) instead of letting it hit the transcript bare.
- **The verdict line is your authoritative "I passed" signal — emit it truthfully.** The scheduler's finish protocol ends by printing `SCHEDULER_VERDICT: PASS` once the AC gate is green and the commit has landed (or `SCHEDULER_VERDICT: FAIL <reason>` + `exit 1` otherwise). `PASS` plus a landed commit is authoritative: it overrides incidental transcript markers, so a deliberately reproduced red test or a grep result containing "Error" will not false-trip `needs_review`, as long as the run genuinely ends green and committed. Exiting 0 with uncommitted changes, or with no verdict line at all, is the #1 cause of needless `needs_review`. Never print `PASS` when the gate is red — that turns a safety net into a silent-failure machine.
- **If your own AC gate failed on a SIBLING job's in-flight file, say so with the right verdict — don't print a lying FAIL.** If the prompt disclosed a `--- FOREIGN WORKING-TREE STATE ---` section and your gate failure is confined to paths that section named as not your work, print `SCHEDULER_VERDICT: BLOCKED_BY_FOREIGN_WIP` (and `exit 1`) plus a `FOREIGN_WIP_PATHS: <path1>, <path2>, ...` line naming exactly the failing paths. The scheduler validates every listed path against the manifest it disclosed to you — list a path it never named, or claim this verdict for your own regression, and it is rejected back to `FAIL`. This is not an escape hatch: it exists so a correctly-diagnosed "not my regression" gets auto-requeued once the sibling clears its WIP, instead of spawning a fix-plan investigation into someone else's unfinished work.
